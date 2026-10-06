# Personal Thongthai on SNK Life OS

The existing SNK Life OS application owns personal Thongthai. Its source of truth is `snk-life-os-private` (`pbbihfipfbpiqbiqlagd`). The existing Vercel project is `snk-life-os-final-stable2`. Neither a new application nor another Supabase project is needed.

## Domain boundary

The shared LINE OA may keep its existing Netlify webhook as a thin ingress. The webhook first resolves an existing business group against the business binding registry. Bound business groups continue through the current Tamma handlers without calling SNK. For other groups or rooms, the ingress sends identifiers only to the signed SNK binding probe. It forwards conversation content only for a known personal binding or an explicit SNK binding-code command. Personal events are removed before business logging and business handlers.

Unconfigured groups are consumed and admin-logged using a group hash, without conversation content or a guessed domain. An unconfigured join does not choose a domain. An explicit business binding command still reaches the existing business binding flow. Failed or incomplete personal routing fails closed; it never falls back to a business assistant.

Personal database access, authorization, Money/secretary engines, memory, encryption and answers run inside SNK. The Tamma bridge has no personal database credentials or personal RPC imports. The shared LINE channel credentials are transport credentials, not a shared data store. Business data remains in the existing Tamma project.

## Existing sources and binding

- Money: existing `transactions`, `financial_accounts`, `transaction_categories`, `recurring_transactions` and `finance_*` RPCs.
- Tasks: existing `tasks` and `secretary_*` RPCs.
- Calendar: existing `schedule_events`, `schedule_event_occurrences` and `lib/schedule-occurrences.ts` recurrence handling.
- Projects, owner decisions and notes: existing `projects`, `decisions` and `notes`.
- Conversation context: existing personal pending states and secretary/day-close contexts in SNK only.

The existing `finance_channel_bindings` registry is extended with `system='snk'`, `source_type` (`group` or `room`) and `allowed_modules`. The signed lookup exposes `scope='personal'`; its existing internal `PERSONAL_FINANCE_PRIVATE` scope is retained for compatibility. The owner is resolved from the active binding and the existing membership registry. The existing dashboard-issued, expiring, one-time code grants membership. Group names do not establish authorization. The existing single-active-group-per-owner constraint is preserved.

Available modules are `money`, `tasks`, `schedule`, `projects`, `notes`, `coach` and `personal_summary`. Module permissions are enforced before queries or writes. Non-owner finance members retain their existing finance permissions; owner-only task, schedule, project and summary data stays owner-only.

## Backend-first questions

`personalQuery()` recognizes natural Thai before pending finance clarification or optional LLM interpretation. `answerPersonalQuery()` calls a fresh service-only `snk_personal_snapshot` RPC with the resolved owner, Bangkok date, requested modules and date range. No chat memory is used as status evidence. The RPC reads only requested modules, excludes other owners and business-linked records, and returns structured data.

Supported questions include `สรุปมา`, `มีอะไรค้าง`, `งานไหนเลยกำหนด`, `งานไหนรอกู`, monthly spending, yesterday's expenses, food totals, highest spending categories, latest money activity, today's/tomorrow's/week's schedule and personal project progress. A latest expense excludes transfers and adjustments. Monthly spending never treats balance adjustments as expenses.

`สรุปมา` combines overdue/owner-action tasks, other active/waiting tasks, open owner decisions, current projects, upcoming personal calendar occurrences and the latest ledger activity. Output is bounded and gives a next action from stored data. Empty sources are reported honestly. Canonical calendar recurrence, skipped occurrences and modified occurrences are preserved.

Natural capture continues through the existing finance and secretary engines. A personal expense writes the SNK ledger with the existing balance/idempotency protections; a task or appointment writes the existing task/calendar models. Missing account or task details use existing clarification. Explicit Tamma/business requests in a personal group are directed to the business group without querying or writing business data.

## LINE delivery and quiet mode

Normal incoming answers use `POST /v2/bot/message/reply` with the incoming reply token. No reply token means no outbound answer; an expired or failed Reply never becomes a Push. No personal Push, Multicast or Broadcast transport is enabled.

Personal coach/reminder runners return `sent:0` and `pull_only_disabled` before reading claims or sending messages. There are no personal Vercel crons. The retained authenticated cron endpoints are inert compatibility endpoints even when the feature is enabled. Explicit reminder dates/settings may still be stored in existing SNK models, but replies explain that automatic LINE reminders are not enabled. No routine health, heartbeat, empty summary or background commentary is sent.

## Runtime configuration and routes

Required server-only SNK Vercel values:

- `SNK_OS_SERVICE_ROLE_KEY` for the existing SNK project only.
- `SNK_OS_GROUP_ENCRYPTION_KEY`, a fresh SNK-only 32-byte base64url key.
- `LINE_CHANNEL_SECRET` and `LINE_CHANNEL_ACCESS_TOKEN` for the existing shared OA.
- `SNK_MONEY_ENABLED=1` when required configuration and verified deployment are ready.

`SNK_OS_SUPABASE_URL` defaults to the canonical existing SNK URL and rejects any other project. Dashboard public Supabase settings and existing authentication are preserved. `OPENAI_API_KEY` is optional for slip-image extraction/optional NLU; deterministic pull queries do not require an AI API key. `CRON_SECRET` only authorizes the retained inert cron endpoints. No secret belongs in documentation, chat, source or build logs.

- `POST /api/line/snk-money`: verifies the raw-body LINE HMAC, serves identifier-only probes, dispatches personal events and Replies.
- `GET /api/health/snk-money`: returns only configuration/reachability booleans; HTTP 200 requires `ready:true`, otherwise HTTP 503.
- `/api/cron/snk-money-coach` and `/api/cron/snk-money-reminders`: authenticated, always quiet.

Readiness checks the SNK project identity, service key, backend RPCs, active binding, LINE credentials, encryption key and enable flag. It never probes a Tamma health URL or reads a Tamma enable flag. These machine routes have their own authentication and do not depend on a dashboard login session.

The first signed personal event reseals the existing legacy group-ID ciphertext with the fresh SNK-only key. It does not rewrite tasks, appointments, finance history or balances, and does not need the old business encryption key.

## Cutover and verification

Run `npm test`, `npm run typecheck` and `npm run build` in SNK. To run the real PostgreSQL concurrency suite without skips, install `embedded-postgres` and `pg` outside application dependencies and run it as a non-root user with `PF_PGTEST_DIR`. It uses a disposable test server and the real migrations, never production tables.

Validate the canonical read/write/idempotency RPCs against SNK using a transaction that rolls back every test write. Run bridge and business regressions on a separate Tamma router branch. Verify current personal queries against the real migrations while business destinations are unavailable. Do not merge the router cutover until the deployed SNK runtime can accept signed probes and answer personal events. Tamma health is not a release gate.

After cutover, remove personal Supabase/encryption/owner configuration from Netlify. Keep only shared LINE transport configuration and the public SNK webhook URL alongside existing business settings. Preserve all business cron schedules and existing Tamma behavior. See the implementation report for actual test evidence and production status; a successful build alone is not live LINE certification.
