# SNK LIFE OS — Project State

Last verified: 2026-09-02 (Phase 2 production promotion in progress — see checkpoint below).

## ✅ PHASE 2 — STABLE PRODUCTION CHECKPOINT (2026-09-02)

**Final verified commit**: `7e98923c560a75f3ec1cf5dbefd2f7b0221ba9b2` on branch
`claude/snk-life-os-i18n-news`, pushed to `origin/claude/snk-life-os-i18n-news`. Working tree clean,
local build re-verified green (`npm run build`, exit 0) immediately before this promotion.

**How Preview deployment got solved this session** (worth keeping — it's now the standing deploy method):
`mcp__Vercel__deploy_to_vercel`'s single-call full-file-tree payload (~317KB for this app) reliably
exceeds a hard per-turn output ceiling in this harness, confirmed identically across the main session and
a dedicated subagent — not fixable by formatting/retrying/delegating. The fix: the existing Vercel
project `snk-life-os-final-stable2` is now **git-linked** to `snkpcn/snk-life-os` (Project Settings → Git,
done via the dashboard by the user), with **Production Branch = `main`** (the old stale prototype branch
nothing pushes to, so linking never risked the then-current manually-promoted Production). A `vercel.json`
(`{"framework": "nextjs"}`) was added to the repo root because the project's persisted framework setting
is `null` from its chaotic history and a git-triggered build otherwise defaults to static-site detection
(`STATIC_BUILD_NO_OUT_DIR`) — same underlying issue the old manual deploys worked around with
`projectSettings.framework`, now fixed at the repo level so every future git-triggered build (Preview or
Production) picks it up automatically. Going forward: **just `git push` — Vercel builds and deploys
itself**, no more manual file-tree assembly needed for this project.

**Promotion mechanism for this checkpoint**: merged `claude/snk-life-os-i18n-news` into `main` and pushed
`main`, which is this project's Vercel Production Branch — this triggers a real Production build of the
exact same verified commit tree (not a rebuild from different source) since it's a plain merge, no
recoding. See the merge commit SHA and the resulting Production deployment ID/verification results
appended below once complete.

**What's live in this checkpoint**: everything from the Phase 1 stable checkpoint (further down this
file) PLUS full Thai/English i18n, the Executive News Intelligence module (World/Thailand/Thai
Rath+fallback/Business/Markets/Tech, 60-second brief, why-this-matters-to-me, Ask Stark about a story,
News→Task/Decision/Note actions, Saved News), and recurring Schedule (daily/weekly/selected-weekdays/
monthly/yearly/custom interval, end-by-date-or-count, skip/edit-this/edit-this-and-future/edit-series,
completion history) with a mobile-safe Start/End form layout (stacks below `sm`, no horizontal overflow).

### Known scope trade-off carried into this checkpoint (unchanged from earlier note)

The bespoke Schedule page dropped `business_id`/`project_id` linking that the old generic-resource-engine
Schedule page had. The Timeline page still reads raw `schedule_events` rows (a recurring event only
shows on Timeline at its literal first-occurrence date, not every occurrence) — Today's Now/Next/Schedule
sections were fixed to expand recurring occurrences correctly, Timeline was not. Worth a follow-up pass.

## 🟡 PHASE 2 CHECKPOINT (superseded by the promotion above once complete) — 2026-09-02

**Branch**: `claude/snk-life-os-i18n-news`
**Commit**: `b97faf8567546d59725890f9b3d996bbdcbe51b8` — pushed to
`origin/claude/snk-life-os-i18n-news` and confirmed matching (`git fetch` + compared, working tree
clean, nothing uncommitted). Diff vs the stable checkpoint (`94f6a69`): 49 files changed,
+2991/-408 lines.
**Local build**: verified passing (`npm run build`, exit 0, all 28 routes compiled, including the new
`/news` page and `/api/news/*` routes) immediately before this checkpoint was written.

### What is complete (code-complete, build-verified, NOT yet deployed to Preview)

- **Full Thai/English i18n**: `lib/i18n/{en,th,index,context}.tsx` — a dictionary-based architecture
  (not hardcoded strings scattered through JSX), covering every page, the generic resource engine
  (`lib/resources.ts` labels/fields/options translated via `translateResourceLabel`/`translateFieldLabel`/
  `translateOption`), a `LanguageSwitcher` in Settings/header/mobile menu, instant switching (no reload),
  persisted to `profiles.locale` when authenticated with localStorage+cookie fallback pre-auth, default
  Thai. Fixed a real latent bug: `lib/date-range.ts` previously computed "today" in the server's UTC
  clock instead of Asia/Bangkok wall-clock time — now Bangkok-safe. `lib/format.ts` is locale- and
  timezone-aware (`Asia/Bangkok` explicit, `th-TH`/`en-US` Intl formatting).
- **Executive News Intelligence module**: `lib/news/*` — server-side RSS aggregation (World: BBC + Al
  Jazeera; Thailand: Thai Rath preferred + Bangkok Post/The Nation fallback; Business/Markets/Tech) with
  per-provider failure isolation (`Promise.allSettled`, never blocks other sources or the rest of the
  app), near-duplicate grouping, and a keyword-based importance heuristic (critical/important/worth
  knowing, kept sparse). New `/news` page (Brief/World/Thailand/Business/Markets/Tech/Saved tabs), a
  "Today in 60 Seconds" AI brief (`/api/news/brief`, Claude-generated with a mechanical non-AI fallback
  when `ANTHROPIC_API_KEY` is unset — never fabricates), a "why this matters to me" AI interpretation
  clearly labeled as inference (`/api/news/relevance`), Ask-Stark-about-this-story grounded in the
  article + live SNK data snapshot, and News → Task/Decision/Note actions via the existing
  `ResourceForm` (new `prefill` prop). Daily News Brief preview added to the Today page. Saved articles
  persisted to a new `saved_news` table (owner-scoped RLS). Migration `07_i18n_and_news` (already applied
  live to `snk-life-os-private`) adds `profiles.locale`, `news_preferences`, `saved_news`.
- **Known caveat, honestly documented in code**: this sandbox cannot make outbound requests to arbitrary
  news sites (confirmed via `WebFetch`, blocked at the network-egress-proxy level, same class of
  restriction as the Supabase/Vercel block documented earlier in this file) — so the RSS feed URLs in
  `lib/news/sources.ts` (Thai Rath especially) were NOT spot-checked live in this session. The fetch
  layer (`lib/news/rss.ts`) validates every response is genuine well-formed RSS/Atom before trusting it
  and silently excludes anything that isn't (timeout, 404, wrong content-type) — a wrong URL degrades
  gracefully to "that provider contributed nothing" rather than breaking the page or fabricating
  articles, but this still needs a real check once deployed (see next actions).

### What remains — THE DEPLOYMENT PROBLEM (root cause now confirmed; blocked on one user action)

**Preview deployment has still not succeeded, but the root cause is now confirmed** (not guessed):
`mcp__Vercel__deploy_to_vercel` requires the ENTIRE ~83-file / 317KB source tree inlined as text in one
tool call (no incremental/diff mode). Emitting that much text in a single assistant turn hit a hard
per-turn output ceiling in this harness — confirmed identically from three different callers (the main
session, twice, and a dedicated subagent given a completely fresh context/budget) — each got a handful
of files in (2 to ~27) before the response cut off, never close to all 83. This is an environment/harness
limit, not a retryable transient error, and not fixable by better formatting, minification, or delegating
to another agent — a subagent hit the exact same wall. Six failed attempts total this session produced
harmless error deployments (`dpl_7kZ6Qrb4oYL8veAfptiBQ916rLS6`, `dpl_DdKiKoqVupCqqq2iiqsY2ttPSDc9`,
`dpl_932dV6Y5rJ2AwH2Asno5CvzKX7eC`, `dpl_3MvGtnquGzJzzZh1bNXTsBniueQU`, `dpl_EJvjGArb4eoZ8ojy3XVf7sUWmhMY`,
`dpl_7S3QSi67DZW2ouRfmSt4eYoNppJe`) — no cleanup needed, they don't affect Production.

**Other routes ruled out:**
- The Vercel CLI (`npx vercel`) would sidestep this entirely (it reads files from local disk, no
  serialization through model output) — but this sandbox's network egress proxy explicitly blocks
  `api.vercel.com` (confirmed via a direct test: `connect_rejected`, organization policy), so the CLI
  cannot reach Vercel's API from here regardless of authentication.
- `mcp__Vercel__create_git_project` was considered again and re-confirmed unsafe: its own tool
  description states it "does not reconnect an existing unlinked project with the same name" — since
  `snk-life-os-final-stable2` is currently unlinked, calling it would create a **new, separate** Vercel
  project, which is explicitly forbidden (canonical project only, no new project ever). No other MCP tool
  can link an existing Vercel project to a repo.

**The fix that works: link the existing Vercel project to GitHub via the dashboard (one manual click,
not a credential).** GitHub already has the complete, correct code (git push works from local disk, so
it never hit the payload-size wall) — once Vercel is watching the repo, it deploys by pulling from GitHub
itself, and no MCP call ever needs to carry file contents again. This was sent to the user as a direct
link (`https://vercel.com/7hchbrnqkg-4613/snk-life-os-final-stable2/settings/git`) with instructions to
connect `snkpcn/snk-life-os` and — important — leave the Production Branch as `main` (the old stale
prototype branch that nothing pushes to), so linking cannot affect the current manually-promoted
Production deployment; only pushes to feature branches like `claude/snk-life-os-i18n-news` will produce
Preview deployments automatically. **Waiting on the user to complete this step.**

Production is untouched and remains exactly at the stable checkpoint above
(`dpl_64zqH1x75pWLFRsNND2CpWH7sEfS`, commit `94f6a69`, live at `https://snk-life-os-final-stable2.vercel.app`).

### Exact next step (start here next session, or once the user confirms the Git link is connected)

1. Confirm the project is now git-linked: `mcp__Vercel__get_git_deployment_context` should show it under
   `linkedProjects` for this team (it showed `[]` before linking).
2. Trigger a Preview build of the current branch: either wait for the user to say Vercel already shows a
   deployment, or push a trivial no-op commit to `claude/snk-life-os-i18n-news` to fire the webhook, then
   poll `mcp__Vercel__list_deployments` (filtered to this project) for the new one.
3. Once READY, verify like the Production promotion was verified: fetch `/login` and `/tasks` (protected
   redirect), a JS chunk (no signup, hardening intact), TH default language, EN switch, a real
   create/save/refresh on something simple, and open `/news` to confirm the RSS providers actually return
   real articles (this could not be checked at all this session — first real look at whether the Thai
   Rath / Bangkok Post / BBC feed URLs actually work) and `/schedule` to confirm a recurring event's
   occurrences actually expand correctly.
4. Full bilingual + News + recurring-Schedule QA per the checklist already sent to the user (language
   switch + refresh + logout/login persistence, every News action, every Schedule recurrence/edit-scope
   action, mobile breakpoints) before considering Preview QA passed.
5. Only after explicit Preview QA sign-off: promote to Production on the same project, exactly as the
   Phase 1 checkpoint was promoted, then re-verify Production.
6. `ANTHROPIC_API_KEY` still needs to be set as a Vercel env var (unchanged ask from before) — without
   it, the News brief and "why this matters to me" fall back to their honest non-AI/not-connected states
   rather than crashing, but won't be using AI until it's set.

### Known scope trade-off from this session (recurring Schedule)

The new bespoke Schedule page (`components/schedule-board.tsx`) does not carry over `business_id`/
`project_id` linking that the old generic-resource-engine Schedule page had — dropped to keep the
recurrence UI shippable in this session. Not wired into the Timeline page's chronological merge yet
either (Timeline still reads raw `schedule_events` rows, so a recurring event only appears there on its
literal first occurrence date, not every occurrence) — Today's Now/Next/Schedule sections were fixed to
expand recurring occurrences correctly, Timeline was not, given time. Worth a follow-up pass.

## ✅ STABLE PRODUCTION CHECKPOINT (2026-09-02)

**Production is now live and verified on the canonical project.** This is the baseline to return to
if anything in a future feature branch goes wrong.

- **Stable commit**: `35d0c4a87d7ec73ce5e1b9541e9f98b75d20df64` ("Update PROJECT_STATE.md: auth
  hardening verified on new Preview deploy") on branch `claude/snk-life-os-audit-u77d7n`. Confirmed
  local `HEAD` matches `origin/claude/snk-life-os-audit-u77d7n` exactly (fetched and compared) — working
  tree clean, nothing uncommitted, nothing unpushed.
- **Production deployment**: `dpl_64zqH1x75pWLFRsNND2CpWH7sEfS`, target=`production`, state=`READY`,
  Vercel project `snk-life-os-final-stable2` (`prj_av6ga8I6fFyWzztnO9sUSd2m8Rp7`) — same canonical
  project used throughout, no new project created. Live at:
  **https://snk-life-os-final-stable2.vercel.app**
- **Post-promotion verification performed** (via `mcp__Vercel__get_deployment` and
  `mcp__Vercel__web_fetch_vercel_url`, plus `get_runtime_errors`/`get_project_deployment_protection`):
  1. Deployment state = `READY`, aliased correctly to `snk-life-os-final-stable2.vercel.app`.
  2. `GET /` and `GET /tasks` (no auth cookie) → both correctly redirect server-side to `/login`
     (`x-matched-path: /login`) — protected-route enforcement confirmed live on Production.
  3. `GET /login` → clean 200, correct HTML/branding (`<title>SNK LIFE OS</title>`).
  4. Fetched the compiled `/login` JS chunk directly from Production and confirmed it is byte-identical
     in logic to the verified Preview build: only `signInWithPassword` is present, the magic-link mode
     toggle compiles to a `!1` (false) literal (fully tree-shaken, flag is off), and there is no
     `signUp`/"Create account" code path anywhere in the bundle.
  5. `get_project_deployment_protection` → `passwordProtection`, `ssoProtection`, and `trustedIps` all
     `enabled: false` project-wide — no Vercel auth wall in front of Production.
  6. `get_runtime_errors` (last 1h) → **no runtime errors** on this deployment.
  - **Not verifiable from this sandbox** (same network-policy wall documented below): an actual
    authenticated create/save/refresh persistence test and a logout→login session-persistence test,
    since this environment cannot complete a real Supabase-authenticated round trip. These were already
    functionally verified in the Preview QA round the user performed on their own device before
    requesting this promotion (real `last_sign_in_at` recorded in `auth.users`), and the exact same
    code/config is now what's running in Production — nothing auth-related changed between the verified
    Preview and this Production deploy.
- **Supabase state unchanged**: still `snk-life-os-private` (`pbbihfipfbpiqbiqlagd`), same schema, same
  RLS, same triggers — nothing was migrated or altered as part of this promotion.
- **Completed features** (all live in Production now): real Supabase Auth (hardened: no public signup,
  magic link hidden behind a flag), Today/Now/Timeline, Schedule, Tasks/Top3/Attention, Business OS,
  Projects, Goals, Money (Accounts/Transactions/Budgets/Assets/Debts/Recurring/Categories), Wishlist +
  Savings Goals with real ledger-based accounting and a real linked-transaction purchase flow, Portfolio,
  Markets (TradingView + price alerts), Notes, Decisions, Reviews, real server-side Stark AI (Claude API,
  graceful no-key fallback), Search/Cmd+K, Settings, Backup/Export/Restore + legacy localStorage import.
  See "What is fully implemented and working" below for full detail — nothing in that list changed.
- **Remaining/future work** (not yet started, intentionally deferred until after this checkpoint):
  1. Visual polish pass + round-2 audit (task 15 below) — mobile keyboard-covers-input, TradingView
     iframe touch-scroll conflicts, overlay z-index edge cases, full breakpoint sweep on authenticated
     pages (390×844, 393×852, 430×932 not yet checked beyond `/login`).
  2. **Next feature phase (to be built on a NEW branch off this exact commit, never directly on
     Production)**: full Thai + English i18n, a Daily World News Brief, a Daily Thailand News Brief, and
     Thai Rath as a Thailand news source where a permitted/reliable source is available. Not started yet.
  3. User action still outstanding (see "Still needs your action" below): turn off "Allow new users to
     sign up" in the Supabase dashboard; set `ANTHROPIC_API_KEY` as a Vercel env var for Stark to work
     for real.
- **New working branch**: `claude/snk-life-os-i18n-news`, branched from `94f6a69` (this checkpoint
  commit on `claude/snk-life-os-audit-u77d7n`, which is `35d0c4a` plus this PROJECT_STATE.md update) and
  pushed to `origin/claude/snk-life-os-i18n-news`. This is where the i18n/News feature phase happens.
  Production must not be modified directly while that phase is in progress.

## Canonical infrastructure

- **GitHub**: `snkpcn/snk-life-os` (only repo used — no new repo created)
- **Vercel**: `snk-life-os-final-stable2` (`prj_av6ga8I6fFyWzztnO9sUSd2m8Rp7`, team `7hchbrnqkg-4613`) — only project used, no new project created
- **Supabase**: `snk-life-os-private` (`pbbihfipfbpiqbiqlagd`, ap-southeast-1) — only project used, no new project created
- **Working branch**: `claude/snk-life-os-audit-u77d7n`

## Audit findings (verified, not assumed)

### GitHub repo — stale, not the real app
- One branch (`main`), one commit (`Add files via upload`).
- Contents: a single 23KB `index.html` — a localStorage-only prototype with a hardcoded keyword-matched fake chatbot. No Next.js, no build tooling, no Supabase wiring, no CI, no previous Work-agent branches or PRs.
- This file predates and does not match the app actually deployed to production (see below). It has been superseded, not deleted (kept in git history).

### Vercel — production has been non-functional since its first deploy
- 29 Vercel projects exist under this account, almost all named `snk-life-os-*` or `snk-*`, created across a chaotic debugging history (`-check`, `-test`, `-fixed`, `-proof` suffixes). None are Git-linked (`link: null` on all).
- Canonical project `snk-life-os-final-stable2` has 11 "production" deployments. **Every single one** only ever uploaded 2 files (`index.html`, `style.css`) per its own build logs ("Downloading 2 deployment files..."). The HTML references `/app.js` for every interactive control (nav switching, all `onclick` handlers: forms, transactions, tasks, Stark chat, backup/export/restore, etc.) — **`/app.js` returns 404 on every deployment of every project checked** (`snk-life-os-final-stable2`, `snk-life-os-working`, `snk-life-os-live-fixed`).
- **Conclusion: 0% of buttons in production have ever worked.** This is worse than "many buttons broken" — the deploy pipeline previous sessions used (raw multi-file API upload) silently dropped the JS file on every attempt, and no working `app.js` source was ever recovered from any live deployment or the git history.
- The recovered `index.html` + `style.css` (dark/gold premium theme, sections: Today/Money/Markets/Portfolio/Projects/Data/Stark) are preserved as the **design reference** for the rebuild's visual language and information architecture, since they represent real prior product thinking even though the JS logic behind them is unrecoverable.

### Supabase — solid, real, worth preserving
- Project `snk-life-os-private`, ACTIVE_HEALTHY, Postgres 17.
- 6 migrations applied: `01_core_structure`, `02_tasks_schedule_activity`, `03_money`, `04_markets_review_notes`, `05_harden_trigger_function`, `06_harden_trigger_function_public`.
- 36 tables in `public` schema, all `owner_id`-scoped for RLS (auth.uid()-based), covering: profiles, businesses, projects, goals, goal_projects, milestones, tasks, schedule_events, activity_log, transactions, budgets, assets, asset_valuations, debts, recurring_transactions, financial_accounts, transaction_categories, holdings, watchlists, watchlist_items, price_alerts, kpis, kpi_entries, reviews, notes, top_priorities, decisions, user_settings, backup_snapshots, ai_context, ai_summaries, wishlist_categories, wishlist_items, savings_goals, savings_contributions, wishlist_price_history.
- `get_advisors(security)` returns **zero lint findings** — RLS appears correctly configured across the schema.
- **Zero edge functions** — no server-side AI backend exists yet.
- **Zero rows in `auth.users`** — clean slate, no real user data at risk, no migration-from-existing-users concern.
- This schema is comprehensive and well-normalized; it is the real deliverable of prior work and is being preserved as-is (additive only, no destructive migrations planned).

## Decision: rebuild the frontend as a real Next.js app on the existing schema

There is no recoverable, working application source anywhere (git or any of the 29 Vercel projects). The only viable path that honors "don't rebuild from scratch" in spirit is:
- Keep the same GitHub repo, same Vercel project, same Supabase project/schema.
- Build a real Next.js 14 (App Router) app with genuine Supabase Auth, deployed via Vercel's first-party deploy tool (not the broken raw-upload method previous sessions used) so `app.js`-equivalent bundles actually ship this time.
- Reuse the recovered design language (dark background, gold accent, card-based layout, bottom nav, section set) as the visual/IA starting point.
- Wire every screen to the real 36-table schema instead of localStorage.

## CURRENT STATE — read this section first (last updated 2026-09-02)

**Latest commit**: `b1b8fc4` "Harden login: remove public signup, gate magic link behind a flag", on
branch `claude/snk-life-os-audit-u77d7n`, pushed to `origin/claude/snk-life-os-audit-u77d7n`. Full
commit history on this branch:
1. `f98ed8d` — PROJECT_STATE.md + package.json scaffold
2. `d123de7` — Full Next.js 14 app build (all features below)
3. `0d1f57c` — Simplified `lib/database.types.ts` from the 2032-line Supabase-generated file to a
   ~20-line generic shape (see "database.types.ts simplification" section below for why this is safe)
4. `570b16b` — PROJECT_STATE.md checkpoint before a usage-limit warning
5. `b1b8fc4` — Removed the public signup path from `/login` entirely (no `auth.signUp` code path
   remains client-side) and gated Magic Link behind `NEXT_PUBLIC_ENABLE_MAGIC_LINK` (default `false`)

**`main` branch is untouched** (still just the old stale `index.html`). Nothing has been merged to
main. A PR has not been opened (not requested).

### Live Preview deployment (WORKING, auth-hardened — latest)

**URL: https://snk-life-os-final-stable2-oqirk4nxz-7hchbrnqkg-4613.vercel.app**

(A prior preview URL `...-alkbzsm7s-...` also exists and still works but is now one commit behind —
use the `oqirk4nxz` URL above, it has the auth hardening.)

- Vercel project: `snk-life-os-final-stable2` (`prj_av6ga8I6fFyWzztnO9sUSd2m8Rp7`), the canonical one — no new project created.
- Deployment ID `dpl_49NjTabWm1GsnhJXuU3S5xLtbrbV`, target=`preview`, state=`READY`.
- **Auth verified live** (2026-09-02): two real accounts now exist in `auth.users`
  (`preechanan.chanon@gmail.com`, `444pcn@gmail.com`); `preechanan.chanon@gmail.com` has a populated
  `last_sign_in_at`, meaning a real successful password sign-in has already happened through the
  deployed app from a real device (outside this sandbox) — end-to-end auth is confirmed working, not
  just theoretically correct.
- **Auth hardening applied and verified** (this update, in response to explicit user request):
  1. **Public signup removed from the UI entirely.** Fetched the compiled login JS chunk directly and
     confirmed it contains only `signInWithPassword` — no `signUp` call, no "Create account" text, no
     toggle. This is a client-side removal only; see "Still needs your action" below for the
     authoritative backend control.
  2. **Magic Link hidden** behind `NEXT_PUBLIC_ENABLE_MAGIC_LINK=false` (in the committed `.env`). The
     compiled JS confirms the mode-toggle UI was tree-shaken away entirely (compiles to a `false`
     literal). Flip to `"true"` in `.env` (or as a Vercel env var) and redeploy once SMTP is verified —
     no other code change needed.
  3. **Protected-route enforcement re-verified on this deployment**: fetched `/tasks` with no auth
     cookie → server-side redirect to `/login` (`x-matched-path: /login`), confirmed via
     `mcp__Vercel__web_fetch_vercel_url`.
  4. **No SSO wall**: fetched both `/login` and a JS chunk directly → plain 200 responses, no redirect
     to a Vercel login page (the project-wide SSO protection disabled earlier still applies to this new
     deployment, as expected — protection settings are project-level, not per-deployment).
- **Session persistence and logout**: implemented via the standard Supabase SSR cookie pattern
  (`@supabase/ssr`'s `createBrowserClient`/`createServerClient` with `getAll`/`setAll` cookie handlers,
  middleware refreshing the session on every request). This is the exact pattern from Supabase's own
  SSR documentation and cannot be exercised end-to-end from this sandbox (see network limitation
  section below), but is structurally correct and is the same code path that already produced the real
  successful sign-in recorded in `auth.users`. Logout (`components/app-shell.tsx::handleSignOut`) calls
  `supabase.auth.signOut()` then redirects to `/login` and calls `router.refresh()` to clear cached
  server data — this needs your on-device confirmation (see checklist below).
- **Still needs your action — not achievable via any available tool**: the authoritative "Allow new
  users to sign up" toggle lives in the Supabase dashboard (Authentication → Providers → Email →
  "Allow new users to sign up"), not in any Supabase MCP tool exposed to this session. Removing the
  signup UI stops a casual visitor from finding it, but someone who already has the public anon key
  (which is, by design, public) could still call the signup API directly until that toggle is off.
  **Direct link**: `https://supabase.com/dashboard/project/pbbihfipfbpiqbiqlagd/auth/providers` — turn
  off "Allow new users to sign up" under the Email provider. This is the one step only you can do.
- **Two deploy bugs fixed earlier** (both project-level misconfigurations, not code bugs, now resolved
  for all future deploys to this project):
  1. `framework: null` was persisted on the project from its chaotic history → Vercel's build treated
     it as a static site and failed with `STATIC_BUILD_NO_OUT_DIR`. Fixed by passing
     `projectSettings: {framework: "nextjs"}` explicitly on every `deploy_to_vercel` call.
  2. The project had **Vercel Authentication (SSO protection) enabled** (`deploymentType:
     all_except_custom_domains`), which would have redirected any real visitor (including the user's
     iPhone) to a Vercel login wall. **Disabled** via `update_project_deployment_protection`
     (`ssoProtection: {enabled: false}`) — this is a project-wide setting, confirmed still in effect on
     the newest deployment too.
- **Production has now been promoted** (2026-09-02) after the user confirmed Preview QA passed. See the
  "STABLE PRODUCTION CHECKPOINT" section at the top of this file for full details. The old broken
  2-file/404-app.js production deployment has been replaced — `snk-life-os-final-stable2.vercel.app`
  now serves this real Next.js app.
- To redeploy (e.g. after further fixes), use `deploy_to_vercel` with target=`preview`,
  name=`snk-life-os-final-stable2`, teamId=`team_Xa2lB3AEknYc1qIFPeQ2IHtF`,
  `projectSettings: {framework: "nextjs"}`, and the current contents of every file in the repo (the
  tool takes a full file set each call, not a diff) — no other code changes needed, this exact repo
  state builds cleanly.

### What is fully implemented and working (code-complete, build-verified)

All of these compile cleanly (`npx tsc --noEmit` clean, `npm run build` succeeds with 23 routes) and
are deployed in the live Preview above:

- **Real Supabase Auth**: email/password (sign up + sign in) and magic link, via `@supabase/ssr`,
  middleware-protected routes (`middleware.ts` + `lib/supabase/middleware.ts`), server/browser client
  helpers (`lib/supabase/server.ts`, `lib/supabase/client.ts`). Session refresh via middleware.
- **Today dashboard** (`app/(app)/page.tsx`): money snapshot, Top 3 today (with inline done-toggle),
  today's schedule, project progress bars — server component, real Supabase queries.
- **Timeline** (`app/(app)/timeline/page.tsx`): tasks + schedule events merged chronologically.
- **Schedule, Tasks/Top3/Attention, Business OS, Projects, Goals, Notes, Decisions, Reviews**: all via
  the generic `ResourceSection`/`ResourceForm` CRUD engine (see below), full create/edit/archive.
- **Money module** (`app/(app)/money/page.tsx`, tabbed): Overview (stats + recent transactions),
  Accounts, Transactions, Budgets, Assets, Debts, Recurring, Categories — all CRUD, tab state in URL.
- **Wishlist + Savings** (`app/(app)/wishlist/page.tsx`, tabbed): Wishlist items with a bespoke "Mark
  Purchased" flow (`lib/wishlist-actions.ts::markWishlistItemPurchased`) that creates a real linked
  `transactions` row and sets `purchased_at`/`purchased_transaction_id` — never fakes the accounting.
  Savings Goals board computes the saved balance **live from the `savings_contributions` ledger**
  (`computeSavingsBalance`), never from a mutable stored field (the schema itself has no such field —
  this was a deliberate ledger design already present in the DB, correctly respected here).
- **Portfolio** (`app/(app)/portfolio/page.tsx`): holdings, watchlists, watchlist items; cost-basis
  stat card explicitly labeled "No live market data connected" (no faked numbers).
- **Markets** (`app/(app)/markets/page.tsx`): TradingView iframe embed (SET stocks, US stocks, gold,
  USD/THB presets, matching the recovered design's preset list) + price alerts CRUD.
- **Stark AI** (`app/(app)/stark/page.tsx` + `app/api/stark/route.ts`): REAL server-side AI via
  `@anthropic-ai/sdk`, model `claude-sonnet-4-5`, system prompt grounded in a live data snapshot
  (today's tasks, overdue tasks, schedule, projects, goals, money) assembled fresh per request from
  Supabase — not a keyword-matched fake like the old prototype. **Requires `ANTHROPIC_API_KEY` to be
  set as a Vercel env var** — without it, the route returns a graceful message telling the user to add
  it (does not crash, does not fake a response).
- **Search / Cmd+K** (`components/command-palette.tsx`): global search across all searchable resources
  + nav-item search, triggered by the search icon or Cmd/Ctrl+K.
- **Settings** (`app/(app)/settings/page.tsx`): profile display_name/currency/timezone/start_of_week,
  upserts to `profiles` (auto-created per-user by the existing `handle_new_user()` trigger on
  `auth.users` — confirmed present in the DB).
- **Backup/Export/Restore + legacy import** (`app/(app)/backup/page.tsx`, `lib/backup.ts`): exports all
  31 user-data tables as one JSON file; restore inserts as new rows (never overwrites); also detects
  and imports the OLD single-file prototype's localStorage export shape (`{metrics, projects}`) into
  Goals/Projects.
- **Generic CRUD engine** (`lib/resources.ts` + `components/resource-section.tsx` +
  `components/resource-form.tsx`): a schema-driven config powers create/edit/archive/delete uniformly
  across ~28 of the 36 tables (relation dropdowns, typed fields, soft-delete via `archived_at` where
  the column exists). Every field `key` and `relationTable` in `resources.ts` was cross-validated by
  script against the live Supabase-generated schema before this was trusted — zero typos found.
- **App shell** (`components/app-shell.tsx`): premium dark/gold theme (matches recovered design
  language), sticky top bar (search + quick-add), bottom nav (Today/Tasks/Money/Stark + "More" sheet
  with the other 13 sections + Log out), safe-area padding for iPhone notch/home-indicator.

### What is NOT done yet

- **Task 15 (visual polish + round-2 audit) — not started.** No pass yet for: mobile keyboard covering
  inputs, chart/iframe touch interception (the TradingView iframe on `/markets` has not been tested for
  touch-scroll conflicts on mobile), overlay z-index edge cases beyond the basic Sheet component, any
  visual regressions specific to 390×844 / 393×852 / 430×932 (only 375×812 and 1440×900 were visually
  screenshotted, all 5 breakpoints were checked programmatically for layout/no-horizontal-scroll on the
  `/login` page only — NOT yet checked on any authenticated page).
- **Task 16 (Production promotion) — explicitly blocked** by the user pending their own iPhone QA pass
  on the Preview URL above. Do not promote without their go-ahead.
- **No real interactive CRUD click-through has been run against live Supabase from an automated
  browser.** See "Sandbox network limitation" below — this environment cannot do it. Data-layer
  correctness was instead verified by: (a) TypeScript compile-time checks catching real bugs during
  development (e.g. `profiles.start_of_week` is actually a string not a number — fixed), (b) a script
  cross-validating every `resources.ts` field key against the live generated schema (zero mismatches),
  (c) direct SQL queries confirming `owner_id` columns default to `auth.uid()` on tasks/transactions/
  wishlist_items, RLS policies are exactly `owner_id = auth.uid()` (or `id = auth.uid()` for
  `profiles`) with `cmd: ALL` on every table checked, and a `handle_new_user()` trigger exists on
  `auth.users` that auto-creates the `profiles` row Settings/Today depend on. These checks give strong
  confidence but are **not a substitute for the real click-through the user will do on their iPhone.**
- **`ANTHROPIC_API_KEY` is not set anywhere** — Stark will show its "not connected yet" message until
  the user adds it in Vercel project settings
  (Project → Settings → Environment Variables, project `snk-life-os-final-stable2`). No other secret
  is needed; the Supabase URL/anon key are public-by-design and already committed in `.env`.
- **Legacy localStorage import has never been tested against real old data** — the mapping in
  `lib/backup.ts::importLegacyData` was written by reading the old prototype's exact field names
  (`metrics[].current/target/unit`, `projects[].phase/milestone/action/blocker`) but there is no
  real exported file to test it against (the old app was never live/functional enough for anyone to
  have exported real data from it).

### database.types.ts simplification — why it's safe (answers the user's runtime-safety question)

The original `lib/database.types.ts` was the full Supabase-generated file (2032 lines, one Row/Insert/
Update type per table). It was replaced with a ~20-line generic shape
(`Tables: Record<string, {Row: Record<string,any>, Insert: Record<string,any>, Update: Record<string,any>, Relationships: unknown[]}>`)
purely to shrink deploy payload size — **TypeScript types are fully erased at build time and have
zero effect on runtime behavior.** Verification performed:
1. Ran `npm run build` with the original strict types → captured route/size output.
2. Swapped in the generic type, ran `npm run build` again → **byte-for-byte identical route table and
   bundle sizes.** This proves the compiled output (what actually runs) did not change at all.
3. All real column names, nullability, and relationships were already independently cross-checked
   against the live schema (see "Generic CRUD engine" above and the RLS/trigger checks above) — that
   validation used the schema data directly from Supabase, not from the TypeScript file, so it is
   unaffected by this change.
4. The places that need per-table type safety most (Today page, Timeline page, Stark route, backup.ts,
   Settings page) were all written and debugged *while the strict types were still in place* — the
   strict types already did their job catching real bugs (e.g. `profiles.start_of_week` is a string,
   `projects.priority` is a string not a number) before being swapped out. Removing them after they've
   already caught the bugs does not un-catch those bugs.
5. RLS, `owner_id` defaults, and the `profiles` auto-create trigger were re-verified directly against
   the database via SQL (not via TypeScript) — see the bullet above. Nullability/required-field
   behavior is enforced by Postgres itself (`NOT NULL` constraints, defaults) regardless of what
   TypeScript thinks the shape is; a wrong TS type could at worst cause a false compile error (caught
   immediately, blocks the build) — it cannot cause silently-wrong runtime behavior, because the actual
   HTTP request bodies sent to PostgREST are built from plain JS objects in `resource-form.tsx`, not
   from anything the TypeScript type system touches at runtime.

**Net: no CRUD write/read behavior, required-field enforcement, nullability, relationship IDs, money
transaction logic, wishlist/savings accounting, schedule/task logic, or RLS behavior changed in any way.
Only the strictness of IDE/compile-time typo-catching for hand-written literal queries changed** (and
even that only for the ~8 files that use literal `.from("tablename")` calls outside the generic engine;
the generic engine's ~28 tables always used `as any` and were never covered by the strict types anyway).

### Sandbox network limitation (important context for whoever continues this)

This Claude Code environment's outbound network policy **blocks all access to `supabase.co` and
`vercel.app`** at the OS level (confirmed via the agent-proxy status endpoint: explicit `403 policy
denial` on CONNECT to both hosts). This means:
- A local `next dev`/`next start` server in this sandbox **cannot reach the real Supabase project**
  (neither server-side nor client-side) — so no authenticated end-to-end testing was possible locally.
- The Supabase MCP tools (`mcp__Supabase__*`) work fine — they go through a privileged first-party
  channel, not this sandbox's own egress — which is how all the schema/RLS verification above was done.
- The Vercel MCP tools work for API calls (`deploy_to_vercel`, `get_deployment`, etc.) and there is a
  special `mcp__Vercel__web_fetch_vercel_url` tool that CAN fetch `*.vercel.app` URLs (used above to
  verify the deployment), but a real Playwright browser in this sandbox still cannot complete an
  interactive flow that calls out to Supabase (signup, data fetch) because the browser's own network
  stack is blocked the same way.
- **This is why the deep interactive click-through audit could not be completed by Claude in this
  session** — it is a hard environment wall, not a shortcut taken. A future session (or the user's own
  browser on their iPhone, which is NOT behind this sandbox's proxy) will not have this problem.

### Exact next actions (in order)

1. **DONE (2026-09-02)**: Preview QA passed, Production promoted, Production verified. See the "STABLE
   PRODUCTION CHECKPOINT" section at the top of this file.
2. Create a new working branch off commit `35d0c4a` (the stable checkpoint) for the next feature phase:
   full Thai + English i18n, Daily World News Brief, Daily Thailand News Brief, Thai Rath as a Thailand
   source where reliable. **Do not modify Production directly during this phase** — all work happens on
   that branch until it is independently QA'd and explicitly approved for its own promotion.
3. Visual polish pass + round-2 audit (task 15, still pending, independent of the i18n/News phase):
   mobile keyboard-covers-input, TradingView iframe touch-scroll conflicts, overlay z-index, full
   breakpoint sweep on authenticated pages (390×844, 393×852, 430×932 not yet checked beyond `/login`).
4. Remind the user to set `ANTHROPIC_API_KEY` in Vercel project settings for Stark to work for real
   (direct link: Vercel dashboard → `snk-life-os-final-stable2` project → Settings → Environment
   Variables), and to turn off "Allow new users to sign up" at
   `https://supabase.com/dashboard/project/pbbihfipfbpiqbiqlagd/auth/providers` (Authentication →
   Providers → Email) — neither is achievable via any tool available to Claude in this environment.
5. Optional cleanup (not blocking): the other 28 stale Vercel projects from the prior chaotic history
   (`snk-life-os-v4` through `snk-schema-probe` etc.) are untouched and harmless but could be deleted
   by the user later to declutter their Vercel dashboard — Claude did not touch or delete any of them.

### Known bugs / risks to watch for during QA

- The `wishlist_items` "Mark Purchased" flow creates a `transactions` row with `account_id: null` if
  the user doesn't pick an account — this is valid per the schema (nullable) but worth confirming it
  displays sensibly in the Transactions list.
- `savings_goals` progress bar divides by `target_amount` — if a user sets `target_amount` to 0 this
  will show 0% via the `Math.min`/`Math.max` guard (not a crash, but worth eyeballing).
- The TradingView iframe embed has not been checked for what happens with no internet/blocked embed
  (e.g. an ad-blocker) — should degrade to an empty iframe, not crash the page, but unverified.
- `next.config.mjs` sets `eslint: { ignoreDuringBuilds: true }` — lint has never actually been run
  against this codebase; only `tsc` and `next build`'s type-check step have.
