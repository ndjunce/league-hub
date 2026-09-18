# Decision Log — League Hub

Append-only. Each entry: date · what was tried · outcome (WORKS / REJECTED / OPEN) · why.
Standalone shareable league-facing site. Spec: fantasy-dashboard `_scratch/LEAGUE_HUB_SPEC.md`.

---

## 2026-09-16 — v1 built: standalone shareable League Hub (Royal Crushers / ESPN via proxy) — WORKS (deploy pending)
Own repo, self-contained `index.html` + `api/espn.js` proxy + `vercel.json`, same clean pattern as busch-apple-trade-tool. League-FACING only — no Trade Finder, no targeting, nothing personal.

**Data source (the key decision):** Royal Crushers is an **ESPN** league (id 963488), NOT Sleeper. A public no-secrets static site can't hold ESPN cookies. Resolved per updated spec: reuse the proven serverless-proxy pattern — copied `api/espn.js` (cookie in Vercel env server-side, returns DATA only, whitelist scoped to 963488, CORS + `espn_auth_expired` clean-state handling). So the shareable public page leaks no secret. Honest tradeoff documented in README: depends on the proxy + a valid ESPN cookie; shows a clean "refresh cookie" state if it expires.

**Provider abstraction:** `LEAGUE = {provider,id,season,name}` config + `providers.espn` (via proxy) + `providers.sleeper` stub — a Sleeper league (public API, no secret) drops in later with zero credential risk.

**Section 1 — League Insights:** power rankings (by points-for, record shown), weekly superlatives (highest/lowest scorer, biggest blowout, closest game, unlucky high-scoring loser, lucky low-scoring winner), positional leaders (top scorer leaguewide per QB/RB/WR/TE/K/DEF by season pts), points left on bench (greedy same-position bench-beats-starter approx, labeled approx), most active managers (acquisitions), this-week matchups. Early-season caveat shown at Week ≤2.

**Section 2 — Playoff Picture:** standings (W-L + points-for tiebreaker), top-N cutoff from `scheduleSettings.playoffTeamCount` (7 for Royal Crushers), games-left from `matchupPeriodCount` (14 → playoffs Week 15). In/out/alive with HONEST win-out / lose-out bounds (only marks clinch/elim when math is certain; everyone ALIVE early). Labeled as bounds, not a projection; grows sharper weekly.

**Verified live (proxy probe):** Royal Crushers returns 12 teams, currentMatchupPeriod 2, playoffTeamCount 7, matchupPeriodCount 14; per-player `appliedStatTotal` (actual, source 0 — NOT projected source 1) available for bench/positional; schedule carries per-team totalPoints + winner for superlatives. Mobile-first (auto-fill grids stack ≤560px; no fixed wide columns).

**NEXT:** create repo `ndjunce/league-hub`, push, import to Vercel, set ESPN_S2/ESPN_SWID env vars, confirm live. Commit author = ndjunce/noreply.
