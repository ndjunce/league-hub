/* ============================================================================
   ESPN serverless proxy for the League Hub (Vercel). Same proven pattern as the
   personal dashboard: the ESPN cookie lives ONLY here in Vercel's encrypted env
   vars, server-side. This function calls ESPN and returns ONLY league DATA to the
   browser — the cookie never leaves the server, so a PUBLIC shareable hub leaks
   no secret.

   ENV VARS (Vercel -> Project -> Settings -> Environment Variables):
     ESPN_S2   = <your espn_s2 cookie value>
     ESPN_SWID = {your-SWID-including-braces}

   Read-only: GETs to ESPN's read endpoint only.
   ============================================================================ */

// Only the League Hub's league(s) may be fetched. Prevents the function from being
// abused to proxy arbitrary ESPN leagues with the cookie.
const LEAGUE_WHITELIST = new Set([
  "963488",   // Royal Crushers
]);

const VIEW_WHITELIST = new Set([
  "mTeam","mRoster","mMatchup","mSettings","mStandings","mSchedule","kona_player_info",
]);

// Origins allowed to call this from a browser. The Vercel deploy is same-origin
// (needs no CORS); allow localhost for local dev. Add the hub's custom domain if any.
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
];

const CACHE = new Map();
const CACHE_TTL_MS = 60 * 1000;

/* ---------- privacy sanitizer (owner decision 5, 2026-10-13) ----------
   ESPN's payload carries every league member's ESPN id (the SWID-format GUID), first/last
   name and notification settings, plus pending waiver claims. A public page needs none of
   it. Before anything is cached or returned:
   - every braced GUID string ("{XXXXXXXX-XXXX-...}": members[].id, teams[].owners[],
     teams[].primaryOwner, ...) becomes a short one-way hash "m" + 10 hex. The same GUID
     always gives the same hash, so owners can still be grouped across seasons (History).
   - these keys are removed wherever they appear: PII (notificationSettings, firstName,
     lastName, displayName), pending claims (pendingTransactions, pendingTransactionIds: bid
     amounts + transaction ids), ESPN blurbs (seasonOutlook, outlooks; unused by the Hub) and
     team.logo (uploaded logos are UUID-keyed image URLs; the Hub shows assets/logos instead).
   Team names/abbrevs, team ids, rosters and currentSimulationResults are kept.
   The client uses player.fullName, so dropping player first/last names changes nothing. */
const crypto = require("crypto");
const GUID_RE = /^\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}$/;
const DROP_KEYS = new Set([
  "notificationSettings","firstName","lastName","displayName",
  "pendingTransactions","pendingTransactionIds","seasonOutlook","outlooks","logo",
]);
function hashId(g){
  const norm = String(g).replace(/[{}]/g, "").toUpperCase();
  return "m" + crypto.createHash("sha256").update(norm).digest("hex").slice(0, 10);
}
function scrub(v){
  if(typeof v === "string") return GUID_RE.test(v) ? hashId(v) : v;
  if(Array.isArray(v)) return v.map(scrub);
  if(v && typeof v === "object"){
    const out = {};
    for(const k of Object.keys(v)){ if(!DROP_KEYS.has(k)) out[k] = scrub(v[k]); }
    return out;
  }
  return v;
}
const HASHED_RE = /^m[0-9a-f]{10}$/;
const ensureHashed = g => (g == null ? g : (HASHED_RE.test(String(g)) ? g : hashId(g)));
function sanitize(data){
  const out = scrub(data);
  // members: keep only the hashed id (count + cross-season key; no names or settings)
  if(Array.isArray(out.members)) out.members = out.members.map(m => ({ id: ensureHashed(m && m.id) }));
  // owners: hashed even if ESPN ever sends them in a non-braced form
  if(Array.isArray(out.teams)) out.teams.forEach(t => {
    if(Array.isArray(t.owners)) t.owners = t.owners.map(ensureHashed);
    if(t.primaryOwner != null) t.primaryOwner = ensureHashed(t.primaryOwner);
  });
  return out;
}

function setCors(req, res){
  const origin = req.headers.origin;
  if(origin && ALLOWED_ORIGINS.includes(origin)){
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async (req, res) => {
  setCors(req, res);
  if(req.method === "OPTIONS"){ res.status(204).end(); return; }
  if(req.method !== "GET"){ res.status(405).json({ error:"method_not_allowed" }); return; }

  const s2 = process.env.ESPN_S2;
  const swidRaw = process.env.ESPN_SWID;
  if(!s2 || !swidRaw){
    res.status(500).json({ error:"server_not_configured",
      message:"ESPN_S2 / ESPN_SWID env vars are not set on the server." });
    return;
  }
  const swid = swidRaw.startsWith("{") ? swidRaw : "{" + swidRaw.replace(/[{}]/g,"") + "}";

  const { league, season = "2026", scoringPeriodId } = req.query || {};
  const leagueId = String(league || "");
  if(!LEAGUE_WHITELIST.has(leagueId)){
    res.status(400).json({ error:"league_not_allowed",
      message:"That league id is not in the server whitelist." });
    return;
  }
  let views = [];
  const raw = req.query.view;
  if(raw){
    const list = Array.isArray(raw) ? raw : String(raw).split(",");
    views = list.filter(v => VIEW_WHITELIST.has(v));
  }
  if(!views.length) views = ["mTeam","mRoster","mMatchup","mSettings","mStandings","mSchedule"];

  const qs = new URLSearchParams();
  views.forEach(v => qs.append("view", v));
  if(scoringPeriodId) qs.set("scoringPeriodId", String(scoringPeriodId));

  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${encodeURIComponent(season)}`
    + `/segments/0/leagues/${encodeURIComponent(leagueId)}?${qs.toString()}`;

  const cacheKey = url;
  const now = Date.now();
  const hit = CACHE.get(cacheKey);
  if(hit && (now - hit.ts) < CACHE_TTL_MS){
    res.setHeader("X-Cache", "HIT");
    res.status(200).json(hit.data);
    return;
  }

  try{
    const espnRes = await fetch(url, {
      headers: {
        "Cookie": `espn_s2=${s2}; SWID=${swid}`,
        "User-Agent": "Mozilla/5.0 (league-hub serverless proxy)",
        "Accept": "application/json",
      },
    });
    if(espnRes.status === 401 || espnRes.status === 403){
      res.status(200).json({ error:"espn_auth_expired",
        message:"ESPN session cookie is missing/expired. Refresh ESPN_S2 + ESPN_SWID in Vercel." });
      return;
    }
    if(!espnRes.ok){
      res.status(502).json({ error:"espn_upstream", status: espnRes.status });
      return;
    }
    const data = sanitize(await espnRes.json());   // sanitize BEFORE caching, so cached copies are clean too
    CACHE.set(cacheKey, { ts: now, data });
    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.status(200).json(data);
  }catch(e){
    res.status(502).json({ error:"fetch_failed", message: String(e && e.message || e) });
  }
};
module.exports.sanitize = sanitize;   // exported for local verification only (the handler stays the default export)
