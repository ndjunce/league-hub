# League Hub

A shareable, league-facing hub for one fantasy league. Two sections: **League Insights** (power rankings, weekly superlatives, points left on bench, positional leaders, activity, matchups) and **Playoff Picture** (standings + who's in/out/alive, growing sharper each week).

**Live:** (Vercel URL added after deploy)

Default league: **Royal Crushers** (ESPN, id 963488).

## Data source & security
- Royal Crushers is an **ESPN** league, so data flows through a **serverless proxy** (`api/espn.js` on Vercel). The ESPN cookie (`espn_s2` + `SWID`) lives ONLY in the Vercel function's protected env vars, server-side. The public page receives only DATA — the cookie never reaches the browser, so this shareable page leaks no secret.
- **Honest tradeoffs:** this is not a pure static site. It depends on (a) the Vercel proxy staying up and (b) the ESPN cookie staying valid (cookies expire periodically → re-paste in Vercel env). If the cookie expires, the hub shows a clean "refresh cookie" state, not a crash.
- **League-facing only:** shows only what the whole league should see. No targeting, no salary/trade tooling, nothing personal.

## Provider abstraction / growth
`LEAGUE` config at the top sets `provider` (`espn` | `sleeper`) + `id` + `name`. ESPN goes through the proxy; a **Sleeper** league (public API, no secret) can be pointed at the same hub later with zero credential risk (the `providers.sleeper` stub is where that drops in).

## Vercel setup
1. Import this repo into Vercel.
2. Set env vars `ESPN_S2` and `ESPN_SWID` (Project → Settings → Environment Variables).
3. Deploy. The page calls same-origin `/api/espn`.

## Local
No build step, but `file://` and `python -m http.server` can NOT load data. On `localhost` the page calls same-origin `/api/espn`,
which only Vercel serves; on any other host it falls back to the dashboard's proxy, which is CORS-limited to `https://ndjunce.github.io`
(and stays that way). To see live data, use a Vercel preview deploy, or run
`npx vercel@64.0.2 dev` after `npx vercel@64.0.2 env pull`. That writes `ESPN_S2` / `ESPN_SWID` to `.env.local`, which this repo does
NOT gitignore yet: never stage it, and delete it when you're done.
Links are shareable: `#insights/wk6`, `#stakes/wk6/odds`, `#playoffs`, `#block`.
