# Personal Thongthai integration record — 2026-10-06

Implementation and regression checks are complete. Live personal cutover remains blocked by missing SNK runtime credentials. This record does not certify live LINE delivery or declare the mission done.

## 1. Repository and workstream

Personal application: `snkpcn/snk-life-os`, branch `codex/snk-private-runtime-20261006`, based on SNK main `4888bb43d7a8463f562e984e595496830dab7e93`.

Shared transport cleanup only: `snkpcn/tamma-chat`, branch `codex/line-domain-router-20261006`, based on business main `b633e01dd5da97ca6453ea28fa868b8070be4a4d`. This second branch removes the old misplaced personal implementation and keeps a thin domain router. It does not implement personal behavior in a business feature branch.

## 2. Files changed

- `lib/snk-money/`: relocated existing Money/secretary engines, a strict SNK RPC client, independent group encryption, natural personal query orchestration, Reply transport, readiness and raw webhook/cron-auth helpers.
- `app/api/line/snk-money/route.ts`: signed personal webhook and identifier-only group probe.
- `app/api/health/snk-money/route.ts`: independent personal readiness endpoint.
- `app/api/cron/snk-money-coach/route.ts`, `app/api/cron/snk-money-reminders/route.ts`: retained authenticated endpoints, always `sent:0`.
- `supabase/migrations/20261006100000_snk_group_id_key_isolation.sql`: extend the existing binding and add service-only personal reads/readiness/room activation; no duplicate data models.
- `lib/supabase/middleware.ts`: machine-route authentication independent of dashboard sessions.
- `lib/i18n/en.ts`, `lib/i18n/th.ts`: Money binding copy describes pull-only behavior.
- `.env.example`, `package.json`, `package-lock.json`, `tsconfig.json`: runtime configuration and repeatable test tooling.
- `tests/`: relocated Money/secretary SQL regressions and added private-runtime, pull-query, Reply, readiness, room and recurrence tests.
- `docs/private-runtime.md`, this record: architecture, operational contract and evidence.

Tamma changes: `netlify/functions/line-webhook.ts`, new `_snk-private-bridge.ts`, `.env.example`, `netlify.toml`, `package.json`, bridge tests and two existing Owner LINE fixtures. Personal engine/health/cron files, copied personal migrations, fixtures/tests and the obsolete SNK handoff are removed from Tamma. All unrelated business code and business cron schedules are preserved.

## 3. Supabase sources

Use only the existing `snk-life-os-private` project `pbbihfipfbpiqbiqlagd` for personal evidence and writes. The server client rejects any other Supabase origin and never falls back to business credentials.

Canonical sources: `transactions`, `financial_accounts`, `transaction_categories`, `recurring_transactions`, `tasks`, `schedule_events`, `schedule_event_occurrences`, `projects`, `decisions`, `notes`, existing personal contexts and `finance_channel_bindings`. Existing `finance_*` and `secretary_*` write APIs, RLS and membership controls remain authoritative.

The cumulative integration SQL was applied to this existing project, recorded in production migration history as:

- `20261006081422` — `snk_personal_pull_routing_and_key_isolation`.
- `20261006081743` — `snk_personal_recent_activity_completion`.
- `20261006082945` — `snk_personal_latest_expense_semantics`.

The repository keeps the idempotent cumulative SQL with its existing unfinished migration filename. No new Supabase project or duplicate calendar/task/ledger system was created.

## 4. Personal LINE group routing

Shared OA event → existing business binding check → bound business group stays in Tamma; otherwise identifiers-only signed probe → configured personal group/room forwards to SNK → SNK resolves owner and module permissions → fresh backend read/write → LINE Reply.

`finance_channel_bindings` adds `system='snk'`, `source_type` and `allowed_modules`; lookup reports `scope='personal'`. Existing dashboard binding codes and membership authorize the owner. Names never authorize a group. Unknown groups are consumed and logged as unconfigured without message content or a guessed domain. Failure never sends personal content to business handlers or memory.

## 5. Personal intents

| Module | Verified natural Thai examples |
| --- | --- |
| Executive summary | สรุปมา; ตอนนี้มีอะไรต้องทำ; มีอะไรต้องตาม |
| Tasks | มีอะไรค้าง; เหลืออะไร; งานไหนเลยกำหนด; งานไหนรอกู |
| Money | เดือนนี้ใช้เงินไปเท่าไหร่; เดือนนี้กูจ่ายอะไรไปบ้าง; เมื่อวานจ่ายอะไร; ค่าอาหารเดือนนี้เท่าไหร่; เงินออกเยอะสุดตรงไหน; ล่าสุดจ่ายอะไรไป; รายการล่าสุดคืออะไร |
| Schedule/tasks | วันนี้มีอะไร; พรุ่งนี้มีอะไร; สัปดาห์นี้มีนัดอะไร; มีนัดอะไร |
| Projects/notes | โปรเจคส่วนตัวถึงไหนแล้ว; ดูโน้ต |
| Existing capture | เมื่อกี้จ่ายค่าน้ำมัน 1800; พรุ่งนี้เตือนให้โทรหาช่างตอนบ่าย |

Missing account/details use existing clarification. Capture reuses canonical models. Reminder dates may be stored, but automatic LINE reminders are not enabled and replies say so.

## 6. How สรุปมา reads real data

The deterministic intent runs before pending finance clarification and optional LLM interpretation. It calls a fresh `snk_personal_snapshot` with the binding owner, Bangkok date and permitted modules. The service-only RPC excludes other owners, business-linked records, completed/cancelled/archived tasks and inactive projects. It reads open decisions and canonical calendar masters/exceptions. Existing recurrence logic resolves skipped and modified appointments.

The answer bounds each section to a few relevant items: overdue/owner decisions, other active/waiting tasks, upcoming appointments, personal project next actions and latest ledger activity. Next action comes from stored task fields. Updated backend rows change the next reply immediately; chat memory never supplies missing evidence.

## 7. Reply and quiet behavior

Incoming questions use the Reply API when a reply token exists. Tests record only `/v2/bot/message/reply`, including a failed Reply; no Push fallback occurs. Missing tokens produce no outbound answer. Personal Push/Multicast/Broadcast is absent from the active transport. Coach/reminder runners stop before delivery claims and return `sent:0`; there are no personal Vercel schedules. Old personal Netlify schedules are removed by the router cutover branch, which must be deployed before production quiet mode can be certified end to end.

## 8. SNK readiness

`GET https://snk-life-os-final-stable2.vercel.app/api/health/snk-money` checks only SNK project identity, service access, required personal RPCs, active binding, LINE transport credentials, SNK encryption and the personal enable flag. It returns booleans without secrets or personal records, HTTP 200 only for `ready:true`, otherwise HTTP 503. No Tamma health endpoint or flag is consulted.

The existing SNK Vercel project has dashboard public Supabase configuration, a fresh SNK-only encryption key and `SNK_MONEY_ENABLED=0`. Three required server values still need secure transfer: `SNK_OS_SERVICE_ROLE_KEY`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`. Optional slip/LLM credentials do not block deterministic pull queries.

## 9. Isolation evidence

- Personal money/task/calendar reads were seeded with business-linked sentinel records and a second owner. Answers and service-role snapshot data excluded all sentinels and other-owner records.
- The personal monthly-spending isolation phrase queried SNK RPCs only. The strict project client rejects a business origin before network access.
- A signed personal webhook answered summary/tasks/money/schedule while every Tamma/other destination was made unavailable. Its only destinations were SNK and LINE Reply.
- Bound business events bypassed SNK probe/dispatch completely, including with SNK unavailable. A real business Owner handler fixture read its business records and used Reply.
- Production business database inspection found no personal binding table, personal ledger RPC or personal snapshot RPC.
- Unknown groups, malformed routing responses and unconsumed personal events fail closed. Personal content is removed before business logging or conversation handling.

These are automated/backend proofs. Live OA cutover and actual owner-group delivery remain unverified until runtime configuration is completed.

## 10. Regression results

- Final SNK `npm test`: 168 tests; 157 passed, zero failures, 11 real-Postgres cases skipped by the root-only local environment.
- Those same 11 concurrency cases were executed separately in a disposable non-root Vercel Sandbox: 11 passed, zero failures, zero skips. Every one of the 168 distinct SNK cases was therefore executed successfully across the two environments.
- Extended pull acceptance: 18/18 passed, including real migration SQL, current backend updates, module permissions, service-role/anonymous grants, room activation, calendar recurrence and Reply-only behavior. Included in the full suite, not additional unique coverage.
- Thin router/business regression: 40/40 passed; includes existing Owner binding/summary behavior and restaurant/activity/stay/cafe/OTOP customer fixtures.
- SNK typecheck and Next production build passed; both repositories passed whitespace/diff checks.
- Production SNK smoke: the actual service role created a temporary account/balance, recorded an expense twice with one idempotency key, checked the correct balance, wrote a canonical task and read both back through the new snapshot. All test writes were rolled back. Source row counts and audit/idempotency counts matched the initial baseline afterward.

Real concurrency covers duplicate LINE deliveries, simultaneous distinct expenses, opposing transfers, balance reconciliation, payment idempotency, delivery-claim locking and one-time binding-code contention. The test VM was stopped after extracting the successful evidence. The complete general suite was validated locally; the VM's separate general-suite attempt was stopped and is not counted as a successful run.

## 11. Production deployment status

The deployment target remains the existing `snk-life-os-final-stable2` Vercel project. The personal enable flag stays off while required credentials are absent. The SNK schema is applied and its canonical RPC smoke/readiness registry checks passed. The shared router cutover remains a separate, unmerged change until the deployed SNK endpoint accepts signed probes. Existing business production is preserved. The final conversation report records the deployed commit and observed HTTP readiness response.

## 12. Remaining blocker and next action

BLOCKER: three existing server credentials are absent from the SNK runtime configuration.

SYSTEM: SNK.

WHY IT BLOCKS: SNK cannot authenticate personal RPC access, verify incoming LINE signatures or send Reply responses without these credentials. This is unrelated to Tamma health.

VERIFIED: SNK schema and actual service-role RPC execution; active binding; isolated query behavior; passing regression/build/typecheck; existing Vercel project and fresh SNK-only encryption. Available connectors cannot retrieve individual-site Netlify secrets, and the required keys were not present in accessible team-level configuration.

OWNER ACTION: authorize browser fallback to securely transfer the existing SNK service key and shared OA LINE credentials into SNK Vercel, then complete deployment/cutover verification. Do not paste secrets into chat. Afterward, remove personal credentials from the shared Netlify runtime while preserving business settings.
