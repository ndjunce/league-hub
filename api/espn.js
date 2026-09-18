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
    const data = await espnRes.json();
    CACHE.set(cacheKey, { ts: now, data });
    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.status(200).json(data);
  }catch(e){
    res.status(502).json({ error:"fetch_failed", message: String(e && e.message || e) });
  }
};
