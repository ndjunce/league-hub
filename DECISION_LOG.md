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

## 2026-09-18 — v4: rename "League Hub" → "Royal Crushers League Hub" — WORKS
Trivial display-only rename. Updated the static `<title>` and `<h1>` fallbacks to "Royal Crushers League Hub", and the JS now builds the header + `document.title` dynamically from config: `hubTitle = \`${LEAGUE.name} League Hub\`` (LEAGUE.name = "Royal Crushers"), so it stays correct if the hub is ever re-pointed at another league. Static fallbacks match the dynamic value. No data/proxy/logic touched; JS parses clean. Commit ndjunce/noreply. Freeze before: v3 at 80e47b7.

## 2026-09-18 — Trade Block tab added — WORKS (simple factual counts only)
New "🔁 Trade Block" tab on the Hub. Per the FINALIZED spec: SIMPLE + FACTUAL only — each team's positional roster COUNT vs Royal Crushers' starting need, labeled surplus / shortage / ok. NO values, NO rankings, NO recommendations, NO manual input / Google Sheet. Auto from the existing Hub ESPN proxy rosters (no new fetch). The analytical layer (value rankings, evaluator) stays OFF the shared board (that's Nick's private tools).

- Starting slots used: QB, RB×2, WR×2, TE, FLEX(RB/WR/TE), D/ST, K.
- `blockStatus(pos,count)`: RB/WR/TE (flex-depth) → short at ≤ dedicated need, surplus beyond starts+flex+backup. QB → short with no backup (≤1), surplus at 3+. **D/ST + K → 1 is normal (ok), short only at 0, surplus at 3+** — refined after first pass false-flagged EVERY team "short at K/DST" (count=1 = need=1). That was noise/misleading; fixed so the board only surfaces actionable thin/deep spots.
- Renders: a team×position grid (counts, color-coded surplus green / short red / ok muted, sticky team column, horizontal-scroll on mobile) + an "at a glance" plain-English list ("deep at WR · thin at TE"). Honest caption: just counts, start your own conversation.

**Verified (node + live rosters):** JS parses clean; tab wired + `paintTradeBlock` called; confirmed factual-only (no ppg/value/rank in the logic). Live output sensible — no false K/DST shortages; real market visible (many teams thin at TE while deep at WR; Isaac/Zach deep at RB). Mobile-first (grid scrolls, sticky team col).
**Freeze before:** v4 at f41eacc. Commit ndjunce/noreply. Blast radius: index.html only (new tab; existing tabs/data untouched).

## 2026-09-18 — v5: fix clipped names, member logos, top-3 weekly, PPG positional leaders, TE surplus fix — WORKS
1. **Clipped names FIXED.** The At-a-glance rows used the rank-`.row` grid (26px first col) so `.nm` ellipsis-clipped to one letter, AND used the long "Name (Team)" `disp`. New dedicated `.ag-row` flex layout: avatar + full short name (Seth/Zach/…) + deep/thin text, no clamp; wraps on mobile, no overflow.
2. **Member logos added.** Copied all 12 files from `fantasy_football_project/pictures_Logos/` into `assets/logos/` (deploy statically; not hotlinked). `MEMBER_LOGO` map (name→file; Evan=.jpg, rest .png) + `logoFor(id)` + `avatarHtml(id,label,size)` (img w/ lazy load + initials fallback on error/missing). Small round avatar now shown by members in At-a-glance, Trade Block grid, positional leaders, top-3. **FLAG:** source PNGs are ~2.3–2.9MB each (~28MB total) — heavy for a shareable page; lazy-loaded + small render, but downscaling later would be a good follow-up (out of scope: spec said copy as-is).
3. **Top-3 weekly scorers per position** — new "Top Scorers — Week N" card tied to the selected week tab; `weekTopScorers(D,wk)` reads each player's actual weekly points (byWeek[wk]), top 3 per QB/RB/WR/TE/D-ST/K w/ owner + points. Verified Wk1 QB: Caleb Williams 37.3, Josh Allen 35.7, Bryce Young 32.4.
4. **Positional Leaders → PPG, dynamic games.** Now leader per position BY points-per-game = season total ÷ games played, where games = count of the player's weekly stat entries (`playerGames`), NOT hardcoded. Verified Josh Allen 76.5 ÷ 2 games = 38.2 PPG. Slimmed label + avatar.
5. **Surplus threshold fixed (Trade Block).** Rewrote `blockStatus` with a consistent "surplus when count ≥ startable+1" rule (startable = dedicated need + flex share). TE: 1→short, 2→ok, **3→surplus** (was neutral). RB 4→surplus. K/D-ST keep "1 is fine." Verified Nick's 3 TE now flags SURPLUS.

**Verified (node + live):** JS parses clean; all pieces present; TE/RB thresholds correct; Nick 3TE=surplus; PPG dynamic; top-3 correct; no hardcoded games count. Mobile-first (names no longer clip; grids scroll).
**Freeze before:** Trade Block at 0417e6c. Commit ndjunce/noreply.
### Logged for LATER (spec #5, NOT this build): map these member logos on Nick's PRIVATE dashboard for cross-league people (People Map). Separate from this league-facing Hub.

## 2026-09-18 — v6: ROYAL PURPLE + GOLD reskin + branded banner — WORKS (skin only)
Visual identity so the Hub looks clearly different from the Busch Apple trade tool (that's navy/blue analytics). Content/data/logic UNCHANGED — CSS theme + header + font only.

- **Palette repaletted via `:root` vars** (cascades everywhere): purple-tinted near-black bg (`--ink:#120a1f`), purple charcoal panels (`--panel:#1c1230`), purple borders, lavender muted text; **accent blue → ROYAL PURPLE `#8b5cf6`** (+ deeper `--accent2:#6d28d9`); GOLD kept/tuned (`--gold:#e6b800`). Winner/surplus GREEN kept, red kept. Swapped the 3 hardcoded blue `rgba(74,168,255,…)` literals (active tab, me-row, week-tab) → purple `rgba(139,92,246,…)`. Verified zero blue literals remain.
- **Branded banner header:** gradient purple banner (`linear-gradient(135deg,#3b1a63→#5b2a86→#2a1147)`) with gold sheen; "ROYAL CRUSHERS" as a big **Oswald** (Google display font, loaded via `<link>`) gold-gradient title (clip-text with a solid `#e6b800` fallback so it's never invisible), "League Hub" subtitle in letter-spaced Oswald. Body font stays the clean system stack (legible).
- **Logo slot:** header has a commented `<img class="banner-logo">` slot + `.banner-logo` CSS ready — dropping a real Royal Crushers logo later is a one-line change; styled text is the fallback for now. JS sets the banner title from `LEAGUE.name.toUpperCase()` (works if re-pointed to another league); `document.title` stays "Royal Crushers League Hub".
- **v5 member avatars** unchanged and look good on purple (round, bordered).

**Verified:** JS parses clean; palette + banner + Oswald + logo slot all present; no leftover blue; gold-title fallback color set. Mobile-first: banner uses `clamp()` for the title (30→54px), flex layout, no overflow. Reversible skin.
**Freeze before:** tag `good-hub-v5` → 972bd7d. Commit ndjunce/noreply. Blast radius: index.html CSS/header only — no data/proxy/logic/sections changed. Did NOT touch the trade tool (differentiation is the whole point).
