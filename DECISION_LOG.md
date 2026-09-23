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

## 2026-08-13 — Live scoring fix (current-week LIVE scores) — WORKS
Per LIVE_SCORING_FIX_SPEC.md. ROOT CAUSE (verified live, not assumed): ESPN leaves matchup `totalPoints=0` for the current/in-progress week until it FINALIZES the fantasy week (Tue after MNF), even though games are played. Reading `totalPoints` alone shows 0 mid-week — that was the "broken live scoring."

**Verified against the live 963488 proxy:** Week 1 (final) matchups carry `totalPoints` (143.26/99.5, …) and have NO `rosterForMatchupPeriod`. Week 2 (current) matchups have `totalPoints=0` but DO carry `home/away.rosterForMatchupPeriod.entries` = exactly the 9 starters (no bench/IR present; `lineupSlotId` reads placeholder 0 in this payload but every entry IS a starter), whose `appliedStatTotal` IS the current-week live points (Gibbs 23.3, Dak 29.76, …). Summing them = 117.9 for the sample team — the real live total.

**FIX (display only, index.html):**
- Added `liveSideScore(side)` in the games build: prefer `side.totalPoints` when >0 (auto-heals on finalize); else sum `rosterForMatchupPeriod`/`rosterForCurrentScoringPeriod` entries' `appliedStatTotal`, excluding slot 20 (BN) / 21 (IR) defensively.
- Each game now carries `live` (computed-from-starters and not finalized) and `finalized` (winner set AND totalPoints>0). Threaded both through `weekGames()`.
- Render: per-game badge **● LIVE** (red) vs **FINAL** (muted) in `muRow`; Weekly Results header explains LIVE = computed from starters while games run, turns FINAL after ESPN locks the week, and that not-yet-kicked-off players show 0 (honest, no fabrication). Superlatives + top-scorers inherit the computed scores automatically (they consume `weekGames`).

**Verification (node vs live proxy):** JS parses clean. Week 1 finals still == raw totalPoints (0 mismatches, all FINAL). Week 2 all 6 matchups non-zero & sensible (117.9/148.9, 126.8/110.4, …), all labeled LIVE, winner=UNDECIDED. 12/12 nonzero sides both weeks.

**Freeze before:** `good-hub-v6` → 26f4d15. Commit ndjunce/noreply. Blast radius: index.html games-build + weekGames + Weekly Results render + CSS only; no data/logic elsewhere changed. Dashboard (private) gets the same ESPN-provider fix later — NOT this task.

## 2026-08-13 — v8: lucky/unlucky fix + top-scorer PLAYER images — WORKS
Per LEAGUE_HUB_V8_SPEC.md. Superlative-logic + display only; live-scoring/data/proxy untouched.

**1. Lucky/Unlucky (weekSuperlatives):** made the two mutually exclusive and cleaned the wording.
- Pools separated explicitly: UNLUCKY drawn only from LOSERS (`!won && pts!==opp`), LUCKY only from WINNERS (`won && pts!==opp`); ties excluded from both. A team plays once/week so it can never appear in both boxes.
- UNLUCKY = loser whose score topped the most OTHER teams that week (`wouldBeat` = # other teams outscored), tiebreak by higher pts. Wording: "117.9 pts and lost — would've beaten 9 of 11 other teams" (or "— most in the league, but still lost" when it was the week's top score).
- LUCKY = winner topped by the most OTHER teams (`wouldLose`), tiebreak lower pts. Wording: "won with just 104.7 pts — only outscored 4 of 11 other teams".
- REMOVED the confusing trailing "by just X" (that was the game margin — meaningless in this context). Only computes when the week has real scores.

**2. Top Scorers — player image instead of owner logo.** At 18px all member logos looked identical and were the wrong subject. Added `playerImgHtml(pid, team, pos, size)`: ESPN headshot (`a.espncdn.com/i/headshots/nfl/players/full/{id}.png`) → chained onerror to NFL team logo (`teamlogos/nfl/500/{abbr}.png`) → position-colored initial (`.pav-fb`) — never a broken image. `weekTopScorers` now carries `id` + `pos`. Owner's NAME still shown as text beside the player. Member logos unchanged everywhere else (standings, at-a-glance, positional leaders) where the member IS the subject.

**Verified (node vs live proxy):** JS parses clean. Wk1 unlucky=team8 (116.4, beat 6/11) / lucky=team12 (113.32, outscored 4/11); Wk2 unlucky=team2 (117.9, beat 9/11) / lucky=team5 (104.7, outscored 4/11) — different teams both weeks (mutually exclusive ✓). All presence checks pass (playerImgHtml, id+pos in weekTopScorers, "by just X" gone).

**Freeze before:** good-hub-v7 → 9e9bef1. Commit ndjunce/noreply. Blast radius: weekSuperlatives logic + superlative render + Top Scorers img + playerImgHtml helper + CSS (.pav). No data/live-scoring/proxy change.


## 2026-09-22 — NEW feature spec: Weekly Stakes / "what this game means" (early-season complement to Playoff Picture)
Nick's idea: for the current week's matchups (LEAGUEWIDE), show how much each game matters — the win-vs-lose swing —
so mid-season games have meaning before the playoff math sharpens. Addressed his "is this pointless?" doubt: winning
always helps, but NOT equally — this surfaces pivotal (two 4-4 teams for the last seed) vs cushion games, and
leaguewide/who-plays-who mapping matters because other teams' results move your picture (root-for/against games).
DECIDED: TWO metrics, filterable + combinable (Seeding · Playoff odds · Both). (1) SEEDING/RECORD DELTA — nearly free,
reuse standings(D) run twice with the game flipped; works Week 1. (2) PLAYOFF-ODDS SWING — enumerate remaining
outcomes when the tree is small (2^k feasible) → real %, else fall back to win-out/lose-out BOUNDS with an honest
"too early for exact odds" label (same discipline as the existing paintPlayoffs). FRAMING (Nick: pick one if forced):
chips on the existing weekly matchup cards, ordered by importance (PIVOTAL/MEANINGFUL/LOW) — glanceable, leaguewide,
no new screen. Grounded in real code (verified): standings() L639, D.schedule L373, paintPlayoffs L644, matchup render
L553-572. Additive, public-Hub-safe (no private/model data), honest odds only when enumerable. Freeze good-hub-pre-
stakes. Spec _scratch/WEEKLY_STAKES_SPEC.md + prompt _scratch/WEEKLY_STAKES_EDIT_PROMPT.md. Build = EDIT chat.


## 2026-09-23 — Weekly Stakes SHIPPED — WORKS
Per _scratch/WEEKLY_STAKES_SPEC.md. Freeze before: good-hub-pre-stakes -> 3462be1 (pushed). Additive only; commit ndjunce/noreply.

**Placement (decided at build):** dedicated "🎯 Stakes" tab (spec Option 2, permitted). Reason: the existing Weekly Results block (paintInsights) is multi-week via wtabs and must stay that way; Stakes is current-week-ONLY + importance-sorted + has its own Seeding/Odds/Both filter, so a separate current-week-scoped pane avoids overloading the existing block. Same .mu-style matchup cards so it still reads as chips on matchup cards.

**Built (all additive, verified vs read code):** new tab data-tab="stakes" + pane #pane-stakes; one line in the .tab click handler; paintStakes() added to the load() paint call (was paintInsights/paintPlayoffs/paintTradeBlock). New pure fns over the existing DATA object: seedMapFrom, recordsSnapshot, seedMapIfWin, remainingMatchups, currentWeekMatchups, oddsSwing (full 2^k enumeration, ODDS_ENUM_CAP=18), boundsFor (win-out/lose-out), importanceBand, plus paintStakes render + filter wiring. New CSS (.stk-*). Does NOT touch the ESPN proxy, standings(D), weekGames(D), schedule/roster parsing, paintInsights Weekly Results, paintPlayoffs, or paintTradeBlock.

**Two metrics (filter Seeding · Playoff odds · Both):** (1) SEEDING/RECORD DELTA — reuse the standings sort on a records snapshot with the one game flipped (+1W winner / +1L loser, PF held at today's value — honest v1); chip shows "Win → 5-2, seed 4 (in) · Lose → 4-3, seed 7 (out)". (2) PLAYOFF-ODDS SWING — when remaining games EXCEPT the target ≤ 18, enumerate ALL 2^k worlds and count the fraction each team lands top-playoffTeams (seed by wins then existing PF) → real %; when the tree is bigger (early season), FALL BACK to win-out/lose-out seed BOUNDS labeled "Too early for exact playoff odds … honest best/worst-case seed bounds instead of a fabricated %." Never a fake precise number. Cards ordered by importance (🔥 PIVOTAL / MEANINGFUL / ➖ low) with PIVOTAL when a team crosses the playoff cut line or the swing is large.

**Verified (node harness vs synthetic + hand math):** JS parses clean (new Function). 8-team synthetic (wk4 of 6, top4): base seeds correct; T4-vs-T5 flip — T4 win→seed2, T5 win→T4 seed4/T5 seed5 — matches standings(D) flipped BY HAND (my first hand-note was wrong; code is right). Odds enumerable at 11 others: T4 win 93.8%/lose 56.3% (swing 37.5), T5 win 43.8%/lose 6.3% — big odds swing even though the single-game SEED delta is small, which is exactly why both metrics exist. Lopsided T1-vs-T8: T1 ~100%/99.2% (near-locked). Big 20-team/70-game league → oddsSwing.ok=false → bounds fallback renders "Too early" + Best/Worst seed, NO % chip. Per-mode chip check: seeding=seed chips only, odds=% chips only, both=both. Filter segs render one "on". Avatars wire to the live MEMBER map. Existing tabs untouched. Chips use flex-wrap + name ellipsis for @390px no-overflow.
