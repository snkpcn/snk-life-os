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

## Status

See TaskList (16 tracked tasks) for live progress. Updated incrementally as implementation proceeds; final state (deployed URLs, QA results, any action required from the user) will be appended before promoting to production.
