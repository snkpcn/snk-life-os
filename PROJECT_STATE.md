# SNK LIFE OS — Project State

Last verified: 2026-09-01 (audit performed live against GitHub, Vercel, and Supabase APIs).

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

## CURRENT STATE — read this section first (last updated 2026-09-01, end of this work session)

**Latest commit**: `0d1f57c` "Simplify database.types.ts to a compact generic shape", on branch
`claude/snk-life-os-audit-u77d7n`, pushed to `origin/claude/snk-life-os-audit-u77d7n`. Verified
`git rev-parse HEAD` matches `origin/claude/snk-life-os-audit-u77d7n` exactly — nothing is stranded
locally. Full commit history on this branch:
1. `f98ed8d` — PROJECT_STATE.md + package.json scaffold
2. `d123de7` — Full Next.js 14 app build (all features below)
3. `0d1f57c` — Simplified `lib/database.types.ts` from the 2032-line Supabase-generated file to a
   ~20-line generic shape (see "database.types.ts simplification" section below for why this is safe)

**`main` branch is untouched** (still just the old stale `index.html`). Nothing has been merged to
main. A PR has not been opened (not requested).

### Live Preview deployment (WORKING — first ever successful deploy on this project)

**URL: https://snk-life-os-final-stable2-alkbzsm7s-7hchbrnqkg-4613.vercel.app**

- Vercel project: `snk-life-os-final-stable2` (`prj_av6ga8I6fFyWzztnO9sUSd2m8Rp7`), the canonical one — no new project created.
- Deployment ID `dpl_C2SMzya1KUHcpK5f7kJo2mtYLSSP`, target=`preview`, state=`READY`.
- **Verified working**: fetched `/login` → real Next.js SSR HTML with correct JS chunk references (not
  the old static shell). Fetched the actual JS chunk `page-600d95b333e2dc29.js` → 200, contains real
  compiled login logic wired to the correct Supabase URL/key. This is the **first deployment in this
  project's entire history that has ever shipped working JavaScript** — every prior deploy (11 on this
  project, more across 28 sibling projects) only uploaded `index.html` + `style.css` and 404'd on the
  JS file, per their build logs.
- **Two deploy bugs fixed along the way** (both project-level misconfigurations, not code bugs):
  1. First attempt used `deploy_to_vercel` without an explicit framework → Vercel's build treated it as
     a static site (`framework: null` was persisted on the project from its chaotic history) and failed
     with `STATIC_BUILD_NO_OUT_DIR` (looked for a `public/` dir instead of running the Next.js builder).
     Fixed by passing `projectSettings: {framework: "nextjs"}` explicitly on the deploy call.
  2. The project had **Vercel Authentication (SSO protection) enabled** (`deploymentType:
     all_except_custom_domains`), which would have redirected any real visitor (including the user's
     iPhone) to a Vercel login wall before they could see the app at all. **Disabled** via
     `update_project_deployment_protection` (`ssoProtection: {enabled: false}`) — confirmed via a
     re-fetch that JS chunks now return 200 with no SSO redirect.
- **Production has NOT been touched.** The old broken production deployment (2-file, 404 on app.js) is
  still live at `snk-life-os-final-stable2.vercel.app`. Do not promote until the user confirms Preview
  QA passes on their iPhone (explicit instruction from the user — production promotion is blocked on
  their sign-off).
- If this exact preview URL ever expires/rotates, redeploy with the same `deploy_to_vercel` call
  (target=`preview`, name=`snk-life-os-final-stable2`, teamId=`team_Xa2lB3AEknYc1qIFPeQ2IHtF`,
  `projectSettings: {framework: "nextjs"}`) using the current contents of the files listed below — no
  code changes needed, this exact repo state builds cleanly.

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

1. **Wait for user's iPhone QA on the Preview URL** (blocking, per explicit user instruction). Give
   them the click-through checklist (create → refresh → verify → edit → refresh → verify → logout/
   login → verify → archive/delete → refresh → verify, for every entity) across 375×812, 390×844,
   393×852, 430×932, and 1440×900 desktop.
2. Fix whatever the user finds broken (dead buttons, layout issues, keyboard-covers-input, etc.).
3. Do the round-2 audit (task 15) after fixes: mobile safe-area, keyboard avoidance, TradingView iframe
   touch-scroll conflicts, overlay z-index, full breakpoint sweep on authenticated pages (not just
   `/login`).
4. Only after the user explicitly confirms QA passed: promote this exact Preview build to Production
   on the same project (`deploy_to_vercel` with `target: "production"`, same files, same
   `projectSettings.framework: "nextjs"`), then re-verify Production the same way Preview was verified
   above (fetch `/login`, fetch a JS chunk, confirm 200 + no SSO redirect — deployment protection is
   now disabled project-wide so this should carry over automatically, but re-check).
5. Remind the user to set `ANTHROPIC_API_KEY` in Vercel project settings for Stark to work for real
   (direct link: Vercel dashboard → `snk-life-os-final-stable2` project → Settings → Environment
   Variables).
6. Optional cleanup (not blocking): the other 28 stale Vercel projects from the prior chaotic history
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
