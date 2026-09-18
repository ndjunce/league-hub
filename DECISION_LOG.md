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

## 2026-09-16 — v2: standings, weekly view, margin-aware superlatives, real names, auto-refresh — WORKS
Batch of Nick's requested changes (index.html only). League-facing, mobile-first.

1. **Removed "Most Active Managers"** entirely.
2. **Replaced "Power Rankings" with plain "Standings"** — W-L order, points-for as the tiebreaker column, no editorializing.
3. **Weekly view = week tabs** inside the Insights tab (Week 1, Week 2, …), default to latest; each tab shows that week's matchups + that week's superlatives. Built from ESPN schedule per matchupPeriodId.
4. **Margin of victory** shown on each matchup (`+X.X`), and folded into **context-aware lucky/unlucky**: UNLUCKY = lost but scored well (ranked by how many OTHER teams that week it would've beaten + beat-median + small margin); LUCKY = won but scored poorly (how many outscored them, below-median, small margin). Verified live Week 1: UNLUCKY = Thor (116.4, lost, would've beaten 6), LUCKY = Ben (113.3, won, 7 outscored him) — real context awareness, not just "high score that lost."
5. **Auto-refresh:** live-on-load + a light `setInterval` re-pull every ~2.5 min (checkbox, on by default, pauses when tab hidden), plus an honest "Updated HH:MM" stamp. Foot text explains it re-pulls (doesn't push).
6. **Real member names** via `MEMBER` map keyed by ESPN teamId (immune to name edits). Reconciled the two fuzzy ones against the LIVE 963488 team list: id 17 "Mr. Beer's Boys" = Zach, id 13 "5" = Evan. Resolved `disp`/`short` on each team at build; all render sites (standings, superlatives, matchups, bench, positional owners, playoff standings) use real names; falls back to ESPN team name if unmapped. All 12 verified mapping correctly.

**Verified (node, live Royal Crushers + syntax):** JS parses clean; Most Active Managers + Power Rankings gone; Standings/week-tabs/margin/member-map/auto-refresh all present; all 12 names map; context-aware superlatives produce correct Week 1 output. Mobile-first (week tabs wrap, auto-fill grids stack ≤560px).
**Freeze before v2:** v1 pushed at 579cd9d. Commit author = ndjunce/noreply. Blast radius: this repo's index.html only. Live: https://royalcrushersleaguehub.vercel.app/

## 2026-09-18 — v3: bench REMOVED, weekly-results clarity, live current week, all-week tabs — WORKS
Correctness + clarity fixes Nick found.

1. **"Points Left on the Bench" REMOVED** (per "exact or gone"). Investigated an exact optimal-legal-lineup solver: I DID build a correct max-weight assignment over the real startable slots (QB,RB,RB,WR,WR,TE,D/ST,K,FLEX from `rosterSettings.lineupSlotCounts`) respecting each player's `eligibleSlots`, and it produced Nick Week 1 = 9.3 (matching the spec's stated real value). BUT verifying "actual started" against the schedule's real per-team Week-1 totals exposed the blocker: ESPN's `mRoster` only exposes the CURRENT roster, and rosters have churned since Week 1 (my current-roster reconstruction gave Nick 123.4 vs the true historically-started 104.7 — mismatch on 11 of 12 teams). So a PAST week's optimal-vs-actual can't be computed exactly from available data. Exact is impossible for past weeks → REMOVED rather than ship a misleading number. (Left a code comment explaining why.)

2. **Weekly Results redesigned** — killed the ambiguous lone middle number. Each matchup now shows the score on EACH side, the WINNER highlighted (brighter text + ▸ marker), and the margin (`+X.X`) attached to the winner's side. `vs` in the middle (or `tie`). New `.side.win` styling.

3. **Live current week on load** — week tabs default to the CURRENT week (Week 2); current-week games render live/in-progress with finals where done. Verified: Week 2 currently returns 0/UNDECIDED (Thu 9/18, games not yet played) — handled honestly (shows matchups, fills scores as they arrive via the existing ~2.5-min auto-refresh). No hidden `totalPointsLive` field exists; scores simply populate in `totalPoints` once games play.

4. **Week tabs for ALL weeks** — tabs now Wk1..Wk{regWeeks} (1–14), not just completed. Past = final results, current = live, future = "hasn't been played yet" + scheduled matchup preview (names only, no fake scores).

5. **Wording:** closest game no longer says "edged … by" — now "won by just X over …". Removed the "edge" phrasing per Nick.

**Verified (node + syntax):** JS parses clean; benchPoints function + render gone; no "edged"; all-week tabs 1..14 default to current; winner-highlight muRow + score-on-each-side; future/scheduled handling; live Week-1 results render correctly (Riley def Charlie +43.8, Henry def Thor +5.1, etc.). Mobile-first unchanged.
**Freeze before v3:** v2 at f077ef6. Commit author = ndjunce/noreply.
