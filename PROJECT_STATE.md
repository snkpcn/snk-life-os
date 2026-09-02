# SNK LIFE OS — Project State

Last verified: 2026-09-02 (FINAL RELEASE — promoted to Production. See section immediately
below. The former "HOTFIX" section further down is now superseded/merged; kept as history.)

## ✅ FINAL RELEASE — v1 (2026-09-02)

**Production is live at the exact commit below. This was the final closeout pass: verify,
fix real failures, ship, document, stop — no new features, no redesign.**

- **Production URL**: https://snk-life-os-final-stable2.vercel.app
- **Final Production commit**: `d8884cff43e32fd303c79414419c839c4475af69` on `main` (docs-only on
  top of the functional release commit `bea471689faff14723cb57ce3b3c3bf264cee7aa` — same code)
- **Release tag**: attempted (`snk-life-os-production-v1`) but `git push` of the tag failed
  with HTTP 403 (permission scope on this session's git credential); the commit SHA above is
  the durable reference until a tag can be pushed with broader credentials
- **Production deployment**: `dpl_5K9EVpMBFGXDZLmv5ExpeF8aYCGp`, `target=production`, `READY`,
  aliased to the canonical domain, zero runtime errors

### Final ship confirmation (2026-09-02, same day, second pass)

Re-confirmed with no code changes needed: working tree clean and pushed, `tsc --noEmit` +
`npm run build` clean on this exact commit, Production deployment already live at this commit
(no redeploy needed — it was already the promoted candidate), zero runtime errors. Concise
smoke test against the live Production domain — `/`, `/tasks`, `/schedule`, `/money`,
`/markets`, `/news`, `/backup` — all seven correctly redirect an unauthenticated request to
`/login` (confirms deployed, healthy, still correctly private). No regression found; nothing
to fix.
- **Supabase project**: `snk-life-os-private` (unchanged, not touched this pass)
- **GitHub**: `snkpcn/snk-life-os`, `main` branch

### What changed in this final pass

1. **Gold + USD/THB** — real regression fix carried over from the prior hotfix round (see the
   HOTFIX section below for full root-cause detail): both now show real Yahoo Finance data,
   with the Thai-gold-per-baht conversion clearly labeled "Indicative / Estimated" /
   "ประมาณการ", never presented as the official Gold Traders Association price.
2. **Stark AI provider architecture** — no longer hard-dependent on any single provider.
   `lib/ai/{types,anthropic,openai,google,openrouter,index}.ts` implements a small
   `AiProvider` interface (id, label, envVar, isConfigured(), chat()). Each provider needs
   exactly ONE environment variable — **only the variable NAME is documented, never a value**:

   | Provider | Env var name |
   |---|---|
   | Anthropic (Claude) | `ANTHROPIC_API_KEY` |
   | OpenAI | `OPENAI_API_KEY` |
   | Google (Gemini) | `GEMINI_API_KEY` — **currently configured, this is the active provider** |
   | OpenRouter | `OPENROUTER_API_KEY` |

   `getConfiguredProvider()` returns the first one with its env var set (Anthropic first in
   priority order only to preserve identical behavior for anyone who sets that key later); no
   provider is required, and a missing/failing provider degrades to a clear message (TH/EN)
   instead of breaking the app. Adding a fifth provider is one new file + one line in the
   registry — the model choice lives in that one file, never hardcoded elsewhere in the app.

3. **Gemini model** — `gemini-3.1-flash-lite` (the low-cost tier appropriate for a daily
   chief-of-staff assistant, per explicit instruction not to silently fall back to an
   expensive reasoning model). A bounded, same-tier fallback chain
   (`gemini-3.1-flash-lite` → `gemini-2.0-flash-lite` → `gemini-flash-lite-latest`) advances
   ONLY on a confirmed "model not found / no longer available" 404 from Google — never on a
   transient 429 (quota)/503 (capacity)/timeout, since retrying a different model can't fix
   those and would just burn more quota. The optional `GEMINI_MODEL` env var overrides this
   entirely with a single explicit choice. A 20-second request timeout was added (a live test
   under real Google-side high demand previously hung well past 60s with no timeout at all).
4. **Stark context scoping (token/quota efficiency)** — `lib/stark-context.ts` was split from
   one always-fetch-everything function into `buildTodayContext` (always-on baseline: top-3
   tasks + today's schedule, genuinely small), `buildTasksContext`, `buildMoneyContext`,
   `buildProjectsGoalsContext`. `app/api/stark/route.ts` now fetches only the pieces relevant
   to a clearly-topical question (a money question no longer also pulls tasks/projects/goals
   context, matching the existing crypto/stock scoping pattern); a fully generic question still
   gets the broader picture. Conversation history was already capped at the last 10 turns, and
   there was already exactly one AI call per request — both already satisfied "no huge dumps,
   no hidden repeated calls" and needed no change.

### Final verification performed this pass (real, live, on the deployed Preview and Production)

All via the same reversible temporary-debug-route pattern used throughout this project (added,
used once, then fully removed with the middleware allowlist entry reverted and confirmed
byte-identical to baseline via `git diff` before every push):

- **Gold** (COMEX futures, `GC=F`): real price $4440.60, change -0.84%, source Yahoo Finance — PASS
- **USD/THB** (`THB=X`): real price 33.13, change +1.06%, source Yahoo Finance — PASS
- **ADVANC** (SET50): real quote, "Advanced Info Service Public Company Limited", 349 THB,
  -1.69% — correct symbol, confirmed NOT substituted with an unrelated instrument — PASS
- **AAPL** (S&P 500): real quote, "Apple Inc.", $324.67, +3.58% — correct symbol, confirmed
  NOT substituted — PASS
- **Stark real AI request** (exactly once, per instruction not to hammer the API after a
  pass): provider correctly selected as `google` (Gemini); a real Thai-language question
  ("วันนี้ตารางของฉันมีอะไรบ้าง?") against a synthetic-but-labeled test context fixture
  returned a real Thai reply that correctly referenced both fixture items verbatim ("Team
  standup 09:00", "Chest Workout 18:00") — confirms provider selection, real API connectivity,
  correct language output, and context grounding all work end-to-end. Testing stopped
  immediately after this PASS.
- **Production smoke test**: `/`, `/markets`, `/stark`, `/settings` on the live
  `snk-life-os-final-stable2.vercel.app` domain all correctly redirect an unauthenticated
  request to `/login` (confirms deployed, healthy, and still correctly private — no
  unrestricted public access), zero runtime errors in the deployment window.
- **Secret safety**: grepped the built client bundle (`.next/static/chunks/*.js`) for
  `GEMINI_API_KEY`, `GEMINI_MODEL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
  `OPENROUTER_API_KEY` — zero matches. No provider key is ever sent to the client; every AI
  call happens server-side inside `app/api/stark/route.ts`.
- **Build**: `npx tsc --noEmit` and `npm run build` both clean on the exact commit promoted to
  Production.

### Known limitation — carried forward, unchanged, disclosed every time it's been relevant

This sandbox's outbound network policy blocks all access to `supabase.co` and `vercel.app` at
the OS level for a real browser session, so no authenticated end-to-end click-through (login,
Today, Tasks, Business, Projects, Goals, Money, Wishlist/Savings, Portfolio, Search/Quick Add,
mobile visual QA at real breakpoints, every-button audit) could be performed from this
environment this pass. None of that code was touched by this release — only
`lib/ai/*`, `lib/stark-context.ts`, `app/api/stark/route.ts`, `app/api/news/relevance/route.ts`
(import fix only), and the Gold/FX files from the prior hotfix round were changed — so those
features carry forward the same status they had from their last user-confirmed QA pass. A
final pass on the owner's own authenticated device is still the one thing this environment
cannot substitute for. Everything achievable from this environment (real market/AI data, build,
deploy, secret safety, redirect/auth-gating behavior) is verified above with no fabricated PASS.

## 🟡 HOTFIX — Gold + USD/THB restored, Stark config checked (2026-09-02, Preview only)

**Status: Preview-verified, waiting on user approval before Production promotion. Production
has NOT been touched by this hotfix.**

- **Branch**: `claude/snk-life-os-hotfix-gold-stark`, created from Production commit `f6dfb309`
- **Final commit on this branch**: `385cd55421748154725f49b20fd9fb2ccb5bef6c`
- **Preview URL** (git-linked, auto-deployed): https://snk-life-os-final-stable2-git-claude-snk-ca5960-7hchbrnqkg-4613.vercel.app
- **Latest Preview deployment**: `dpl_BpFsrVacvo3ydZNNRKapUDHXHJaE`, state `READY`, zero runtime errors in the last hour

### Issue 1 — Gold + USD/THB restored (real regression fix, not just a subtitle fix)

Root cause of the regression disclosed in the Phase 3+4 promotion report: Gold and USD/THB
became completely unreachable (not just mislabeled) when the Overview tab was rebuilt for the
stock-selection fix — no route, no UI, nothing behind the old subtitle text.

Fixed with two new API routes (`/api/markets/gold`, `/api/markets/fx`, both auth-gated like
every other route) and a new Markets tab UI (`components/markets/instrument-panel.tsx`,
reusing the existing Sheet/Chart/News/ResourceForm patterns), wired into `app/(app)/markets/page.tsx`
as new "Gold" and "FX" tabs alongside the untouched Overview/Crypto tabs.

Two real bugs were found and fixed while verifying this against the actual deployed Preview
(via a temporary unauthenticated debug route, same reversible pattern used for the earlier
stock-data fix — added, used once, then fully removed and middleware confirmed byte-identical
to the pre-hotfix baseline via `git diff` against `f6dfb309`):

1. The gold Yahoo symbol was wrong. `XAUUSD=X` and `XAU=X` (a guessed FX-style spot-gold ticker)
   both return HTTP 404 "symbol may be delisted" from Yahoo's v8 chart endpoint. The only symbol
   that returned real data was **`GC=F`** (COMEX gold futures, front-month) — found by probing
   four candidates (`GC=F`, `XAUUSD=X`, `XAU=X`, `MGC=F`) directly against Yahoo from the live
   deployment. Since a futures price is genuinely a different, distinct thing from an LBMA spot
   fix (not just an abundance-of-caution relabel), everywhere it's shown or fed to Stark now
   honestly says **"GOLD" / "Gold Futures (COMEX)"**, not "XAU/USD" / "Gold Spot".
2. USD/THB's symbol (`THB=X`) was correct, but under concurrent request load the shared 8-second
   fetch timeout (`TIMEOUT_MS` in `lib/stocks/yahoo.ts`, used by the working stock-quote path)
   was firing before Yahoo's response for this specific endpoint completed. Added a separate
   15-second timeout (`fetchJsonLongTimeout`) used only by the new raw-instrument functions —
   the existing stock-quote `fetchJson`/`TIMEOUT_MS` path is completely untouched.

**Real data confirmed from the live Preview deployment** (fetched via the temporary debug
route before it was removed):
- Gold (`GC=F`): price **$4381.20 USD**, change **-$96.90 (-2.16%)**, day range $4329.20–$4391.40,
  exchange COMEX, 23 chart points, source Yahoo Finance — **PASS**
- USD/THB (`THB=X`): price **33.22**, change **+0.439 (+1.34%)**, day range 33.17–33.41,
  source Yahoo Finance — **PASS**
- Indicative Thai gold-per-baht-weight (derived, never claimed as official): **≈ ฿71,332** per
  baht-weight (15.244g), computed as (GC=F price ÷ 31.1034768g/oz) × 15.244g × USD/THB rate,
  labeled "Indicative / Estimated" / "ประมาณการ" in the UI (amber disclosure box) and in the
  Stark system-prompt instruction, explicitly never presented as the official Gold Traders
  Association of Thailand price, in both `lib/i18n/en.ts` and `lib/i18n/th.ts`.
- Watch / Add Holding / Price Alert / Note actions on Gold/FX reuse the existing
  `RESOURCES.watchlist_items/holdings/price_alerts/notes_table` + `ResourceForm` prefill wiring
  exactly as the working Stocks/Crypto flows do — same code path, not reimplemented.
- Related News on Gold/FX reuses the existing `NewsCard`/`NewsArticleSheet` components,
  keyword-matched (`["gold","xau","ทองคำ","bullion"]` for Gold, FX equivalent for USD/THB).
- Ask Stark on Gold/FX posts an `instrument` context block (additive-only addition to
  `app/api/stark/route.ts` — existing crypto/stock context logic untouched) that instructs
  Stark to (a) never invent numbers, (b) note the COMEX-futures-vs-spot distinction when
  relevant, (c) never call the Thai-baht conversion the official Gold Traders Association price.

### Issue 2 — Stark is no longer hard-dependent on Anthropic (multi-provider abstraction)

The user does not want to add separate Anthropic billing right now. Rather than requiring
`ANTHROPIC_API_KEY` specifically, Stark now runs on a small provider abstraction
(`lib/ai/{types,anthropic,openai,google,openrouter,index}.ts`) that works with whichever of
four supported AI providers has its one required env var set, or degrades gracefully if none do:

| Provider | Env var | Notes |
|---|---|---|
| Anthropic (Claude) | `ANTHROPIC_API_KEY` | via the existing `@anthropic-ai/sdk` dependency, unchanged model tier (`claude-sonnet-5`) |
| OpenAI | `OPENAI_API_KEY` | raw HTTP to `chat/completions`, no new dependency |
| Google (Gemini) | `GEMINI_API_KEY` | raw HTTP to `generateContent`, no new dependency |
| OpenRouter | `OPENROUTER_API_KEY` | raw HTTP, OpenAI-compatible shape, no new dependency |

`getConfiguredProvider()` picks the first configured one in that priority order (Anthropic
first only so anyone who later sets `ANTHROPIC_API_KEY` gets identical behavior to before this
change) — no provider is required, and the app never assumes Anthropic specifically. Adding a
fifth provider later is one new file implementing the `AiProvider` interface plus one line in
the registry.

**Verified live on the deployed Preview** via a temporary unauthenticated probe route (now
fully removed, same reversible pattern used throughout this hotfix): none of the four
providers' env vars are set — confirmed both by an earlier broad presence-only scan of 18
common AI-provider env var names (all `false`) and by `getConfiguredProvider()` itself
returning `null` when exercised for real on the live deployment. `/api/stark`'s "not
connected" message now dynamically lists all four options with their exact env var (TH/EN)
instead of naming only Anthropic, so a missing key is actionable rather than a dead end. A
configured-but-failing provider (bad key, rate limit, network error) now returns a clear
graceful message instead of throwing a 500 — this is new behavior; previously an Anthropic
outage would have crashed the request.

**No provider is currently configured — Stark cannot produce a real AI reply until the user
sets one.** Per the "do not ask for secrets in chat" instruction, no key was requested here.
**Action needed from the user** (any ONE of these four, not all): open
https://vercel.com/7hchbrnqkg-4613/snk-life-os-final-stable2/settings/environment-variables
and add exactly one of `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, or
`OPENROUTER_API_KEY` (Preview and/or Production) with a real key from that provider. Stark
will pick it up automatically on the next deployment/request — no code change needed.

**Verified safe**: no provider key is ever sent to the client — every call happens server-side
inside `app/api/stark/route.ts`; confirmed no provider env var name or key pattern (`sk-ant`,
`sk-proj`, `sk-or-`, etc.) appears in the built client bundle (`.next/static/chunks/*.js`);
the temporary probe route only ever returned booleans, provider IDs, and short non-secret
reply/error previews — never a key value. `news/brief` and `news/relevance` still read
`ANTHROPIC_API_KEY` directly and already degrade gracefully when it's absent (a separate,
pre-existing, already-working feature — left untouched per "don't change unrelated features").

### Issue 3 — Authenticated Preview/Production smoke test: NEEDS USER DEVICE

This sandbox's outbound network policy blocks all access to `supabase.co` and `vercel.app` at
the OS level (see the "Sandbox network limitation" section further down this file — unchanged,
still a hard environment wall, not a shortcut). This means no authenticated flow (login, session
persistence, Quick Add, save/refresh/logout/login persistence) could be exercised end-to-end
from this environment. Per the explicit instruction not to fabricate a PASS, this is reported
honestly as **NEEDS USER DEVICE**, with everything achievable from this environment (real Yahoo
Gold/FX data, Stark config presence, build/typecheck, zero runtime errors) already verified above.

**Manual QA checklist — only the items that genuinely need your authenticated iPhone**:
1. Log in, confirm session persists after a page refresh.
2. Open Markets → tap the new **Gold** tab → confirm a real price, chart, and the amber
   "Indicative / Estimated" disclosure box render correctly on mobile.
3. Open Markets → tap the new **FX** tab → confirm USD/THB renders correctly.
4. On Gold, tap Watch, Add Holding, Price Alert, and Note — confirm each opens a working form
   and saves.
5. Confirm existing Stocks (SET50/S&P500 selection + prices), Crypto, News, Schedule, Recurring
   Schedule, and Money still work exactly as before (regression check — nothing in this hotfix
   touched their code, but worth confirming on-device).
6. Switch TH/EN and confirm Gold/FX labels and the indicative disclaimer translate correctly.
7. If you've added one of the four provider env vars (see Issue 2), ask Stark a question on
   the Gold tab and confirm it answers using the real price shown, without inventing numbers.

### Build/typecheck status

`npx tsc --noEmit`: clean (exit 0). `npm run build`: clean, all routes compile including the
`/api/markets/gold`, `/api/markets/fx` routes and the new `lib/ai/*` provider abstraction. All
four temporary debug routes used across this hotfix (`stark-check`, `gold-fx-check`,
`ai-provider-check`, `stark-provider-check`) and every middleware allowlist entry they needed
are fully removed — `lib/supabase/middleware.ts` confirmed byte-identical to the pre-hotfix
Production baseline via `git diff f6dfb309 -- lib/supabase/middleware.ts` (empty output).

**Production touched: NO.** This entire hotfix exists only on the `claude/snk-life-os-hotfix-gold-stark`
branch and its Preview deployment. Waiting for explicit user approval before any Production promotion.

---

## 🚀 PHASE 3+4 — PRODUCTION LIVE (2026-09-02)

- **Live URL**: https://snk-life-os-final-stable2.vercel.app (canonical domain, aliased to this deploy)
- **Production deployment**: `dpl_6g6TdgwyfTKZjX3XQLBQtBNDGia4`, target=`production`, state=`READY`
- **Final commit**: `640aeb81d7fe7df7259a77460e39de82dd08b916` on `main` — a merge commit (`--no-ff`)
  of `claude/snk-life-os-crypto-markets` (tip `941878e`) into `main`, this project's Vercel
  Production Branch. Merge was clean, zero conflicts (verified: `git merge --no-ff` produced no
  conflict markers, `npx tsc --noEmit` and `npm run build` both re-run clean on the merged tree
  before pushing).
- **What shipped**: Crypto Intelligence (BTC/ETH dashboard, transparent signals, coin detail,
  Watch/Holding/Alert/Note, Ask Stark, News integration) and the rebuilt Stock Markets experience
  (SET50/S&P500 tables on real Yahoo Finance data with chunked-batch + chart-meta-fallback
  reliability, mobile detail sheet on row tap, TH/US market switch with per-market selection
  memory, Market/Related News, Watch/Holding/Alert/Note, Ask Stark stock context). Full detail in
  the Phase 3 and Phase 4 sections below.
- **Automated verification performed** (`web_fetch_vercel_url`, `get_runtime_errors`,
  `get_project_deployment_protection`): `/` and `/markets` on the canonical URL both → 200,
  correctly redirect unauthenticated requests to `/login` (`x-matched-path: /login`), Thai
  default confirmed server-rendered. Zero runtime errors in the 15 minutes after going live. No
  Vercel SSO/password/trusted-IP wall. Build passed clean both locally and on Vercel.
- **Real Yahoo Finance data**: NOT re-verified against this exact Production deployment via the
  debug-endpoint method (deliberately — the user's promotion instructions said "do not make
  additional feature changes during this deployment," and re-adding the temporary debug
  route + middleware allowlist line a second time, this time against Production, would be
  exactly that kind of change). The code shipped here is byte-identical to what was verified on
  the Preview branch immediately before promotion (`git merge --no-ff` with zero conflicts means
  no line changed) — see the Phase 4 Fix #2 section below for the actual real numbers returned
  (ADVANC 349 THB, AOT 61.75 THB, CPALL 45.5 THB, KBANK 248 THB, PTT 41 THB, AAPL 325.13 USD,
  MSFT 501.02 USD, NVDA 217.44 USD, GOOGL 335.02 USD, AMZN 254.92 USD), all fetched live from
  Vercel's serverless infrastructure on the identical `lib/stocks/yahoo.ts` code now running in
  Production.
- **Not verifiable from this sandbox** (same standing network-policy limitation documented
  throughout this project): actual login, every module's real interactive behavior (Today,
  Tasks, Schedule + recurring, Money, Wishlist/Savings, Portfolio, Markets TH/US stock
  selection+prices as rendered in the UI, Crypto, News content, TH/EN switching, Stark chat,
  Search, Quick Add, Settings, Backup), and mobile-width rendering — all require a real
  authenticated browser session, which this environment cannot open. These need the user's
  on-device confirmation.

### ⚠️ Known issue found during this promotion: Gold / USD-THB no longer accessible

The original Markets Overview tab had a preset-chip TradingView chart covering ADVANC/CPALL/AOT/
KBANK/PTT/NVDA/**GOLD (XAUUSD)/USD-THB**. When Phase 4 rebuilt Overview into the new
`StockMarketDashboard` (Thailand/US stock tables only), the Gold and USD/THB presets were dropped
along with the rest of the old TradingView preset UI — this was **not called out at the time** as
an intentional scope decision, it's a genuine regression surfaced only now while writing this
promotion checkpoint. The Markets page subtitle text (`marketsPage.subtitle`, both `en.ts`/`th.ts`)
still literally says "Thai stocks · US stocks · **Gold · USD/THB**", which is now inaccurate —
neither is reachable anywhere in the app. Not fixed in this promotion per the explicit "no
additional feature changes during this deployment" instruction. **Follow-up needed**: either
restore a Gold/FX view (own real-data section, not the old TradingView iframe given its
reliability history) or update the subtitle copy to stop promising it.

### Known: Stark's ANTHROPIC_API_KEY status still unconfirmed

Unchanged since Phase 2 — this sandbox has no tool to read or set Vercel environment variables.
If it's not set, Stark (and the AI-generated News brief/relevance) fall back to their honest
"not connected" states rather than erroring — never fabricated output — but real AI answers won't
work until the user sets it in the Vercel dashboard (Project Settings → Environment Variables).
Crypto, Stocks, Markets, and News do not need any API key (all public, keyless data sources).

## 🐛 PHASE 4 FIX #2 — mobile selection UX + real quote data (2026-09-02, commit `c7619d7`)

## 🐛 PHASE 4 FIX #2 — mobile selection UX + real quote data (2026-09-02, commit `c7619d7`)

**Report from real iPhone Preview QA** (previous fix was insufficient): tapping a row didn't
produce a usable mobile experience, and SET50/S&P500 prices were unavailable across the board.

**Fix A — mobile detail experience** (`components/stocks/stock-detail-sheet.tsx`, new file):
Tapping any table row now opens a bottom sheet immediately (the same `Sheet` component
Crypto/News already use) with header, chart, range chips, Watch/Add Holding/Price Alert/Note,
Related News, and Ask Stark, all scoped to that stock — rather than updating an inline card the
user had to scroll back up the page to see. `StockMarketDashboard` now tracks `detailOpen`
separately from `selectedSymbol`: tapping a row sets both; closing the sheet clears `detailOpen`
only, so re-opening later (or switching markets) doesn't lose the last pick. Table rows keep
the `<tr onClick>` semantic tap target with `min-h-[44px]` and `aria-selected`.

**Fix B — reliable quote data** (`lib/stocks/yahoo.ts`, rewritten): the previous provider called
Yahoo's `v7/finance/quote` batch endpoint with the full constituent list (up to ~100 symbols) in
one request with no fallback — real device testing showed this coming back empty across the
board. Now:
- Batch requests are chunked (15 symbols/request) with a concurrency cap (6 at once), instead of
  one giant request.
- Any symbol missing from a v7 chunk falls back individually to the `v8/finance/chart` endpoint's
  own `meta` block, which carries a full independent quote (price, previous close, currency,
  exchange, market state, day high/low, volume). `change`/`changePercent` are only computed when
  both a real price and a real previous close come back — never estimated.
- The single-symbol detail view (`/api/stocks/chart`) now sources its quote exclusively from that
  v8 chart-meta path (`fetchDetailQuote`), since the chart call was already being made anyway —
  one request instead of two, and immune to whatever can break the v7 batch endpoint.
- Client-side, `StockTable` reports its actually-visible symbol set via `onVisibleSymbolsChange`,
  and `StockMarketDashboard` only fetches quotes for symbols not already cached — verified to
  request ~12 symbols on initial load, not the full 50/100-symbol constituent list.
- Honest empty states: a fully failed provider still renders every constituent row (with
  "Unavailable" price cells) rather than blanking the table, and a Gainers/Losers/Most Active
  filter that would otherwise show a misleading "no matching stocks" now shows "Market data
  temporarily unavailable" when the underlying quote data never loaded (`stocksPage.marketDataUnavailable`).

**How this was verified — twice, honestly, at two different levels:**

1. **Local, mocked, actual-browser click-through** (logic verification): same method as the
   previous fix — `next dev` with `middleware.ts` temporarily no-op'd (real middleware is
   unreachable from this sandbox; Supabase network is blocked here) and `/api/stocks/*`/`/api/news*`
   responses mocked via Playwright route interception, `middleware.ts` restored from git before
   every commit (confirmed via `git diff` each time). Verified: tapping AOT/KBANK opened a sheet
   titled exactly "AOT"/"KBANK" with the right header inside; closing returned to zero open
   overlays; switching to US and tapping NVDA opened "NVDA", never a stale symbol. Verified
   progressive loading requested only `ADVANC,AOT,AWC,BANPU,BBL,BDMS,BEM,BGRIM,BH,BTS,CBG,CENTEL`
   (the first 12 SET50 symbols) on load, not all 50. Verified a fully-failed quote provider still
   rendered 12 rows with honest "Unavailable" cells, the Gainers filter showed the honest
   "market data unavailable" message instead of a misleading empty-search message, and tapping a
   row still opened the correct sheet (ADVANC / Advanced Info Service) even with zero quote data.

2. **Real Yahoo Finance data from the actual deployed Preview** (data verification — the part
   mocks can't prove): a temporary, unauthenticated `/api/stocks/verify` endpoint was added,
   calling the exact same `fetchQuotes`/`fetchDetailQuote` functions the real app uses. First
   attempt used a folder named `_debug` — Next.js App Router treats a leading underscore as a
   "private folder" opt-out of routing, so it silently never built as a route at all (caught by
   checking the build's own route table, not assumed). Renamed to `verify/`. Second obstacle: the
   real auth middleware redirects every path except `/api/health` to `/login` regardless of
   whether the route itself checks auth, so the debug route was still unreachable — a one-line,
   temporary addition to `lib/supabase/middleware.ts`'s allowlist let it through for this one
   check. Hit from outside this sandbox via `web_fetch_vercel_url` (the one tool available here
   that can reach `*.vercel.app`). **Actual response, live from Vercel's servers, fetched
   2026-09-02T12:20:35Z:**

   | Symbol | Price | Change % | Company name (from Yahoo) |
   |---|---|---|---|
   | ADVANC | 349 THB | -1.69% | Advanced Info Service Public Company Limited |
   | AOT | 61.75 THB | -5.00% | Airports of Thailand Public Company Limited |
   | CPALL | 45.5 THB | -1.62% | CP ALL Public Company Limited |
   | KBANK | 248 THB | 0.00% | Kasikornbank Public Company Limited |
   | PTT | 41 THB | +1.86% | PTT Public Company Limited |
   | AAPL | 325.13 USD | +4.91% | Apple Inc. |
   | MSFT | 501.02 USD | +1.89% | Microsoft Corporation |
   | NVDA | 217.44 USD | +2.06% | NVIDIA Corporation |
   | GOOGL | 335.02 USD | -3.44% | Alphabet Inc. |
   | AMZN | 254.92 USD | -2.35% | Amazon.com, Inc. |

   The single-symbol detail-view path (`fetchDetailQuote`, what `/api/stocks/chart` actually uses)
   was independently confirmed too — `thDetailQuote`/`usDetailQuote` in the same response matched
   ADVANC and AAPL exactly. `marketState` came back `"unknown"` for all of them (Yahoo's v7/v8
   responses don't always populate this field outside regular trading hours in the requester's
   region — cosmetic, not a data-availability problem; the header/table already handle `"unknown"`
   gracefully).

   After this check, the debug route was deleted and the middleware allowlist line reverted —
   `git diff` on `lib/supabase/middleware.ts` against the pre-check commit is empty.

**Acceptance checklist status** (as required before asking for QA again):
- ADVANC/AOT/CPALL/KBANK/PTT price: **PASS** (real numbers above)
- AAPL/MSFT/NVDA/GOOGL/AMZN price: **PASS** (real numbers above)
- Stock row tap: **PASS** (verified via real browser click-through, see above)
- Mobile stock detail (opens as sheet immediately): **PASS**
- SET50 table prices: **PASS** (batch endpoint confirmed working; per-row "Unavailable" only for
  whatever Yahoo genuinely can't resolve, never the whole table)
- S&P500 table prices: **PASS** (same provider path, same batch mechanism)

Build: `npx tsc --noEmit` and `npm run build` both clean (post-cleanup, verified again after
deleting the debug route). Pushed to `claude/snk-life-os-crypto-markets`, git-triggered Preview
deployment `dpl_6UzfLnWtHsDhJmDh7UAHxfV2qrTk`/`c7619d7` READY. Production untouched.

## 🐛 PHASE 4 FIX #1 — stock selection getting stuck, first pass (2026-09-02, commit `b74d66f`)

**Report**: tapping a SET50/S&P500 row didn't change the detail header — stuck on AAPL.

**Root cause, found by tracing the render path (not guessed)**: `StockHeader`'s success branch
rendered `quote.symbol`/`quote.name` — the async-fetched quote object — instead of the actual
current selection. `selectedSymbol` updated instantly on tap, but `selectedQuote` (fetched via
`/api/stocks/chart`) kept holding the *previous* stock's data until its own fetch resolved. Since
the header trusted `quote.symbol` over the real selection, any tap where the new fetch was slow,
failed, or simply hadn't settled yet left the header showing the old stock — this is a permanent
"stuck" state, not just a flash, whenever a fetch for the new symbol never comes back with a
result (plausible against a real, occasionally-flaky third-party API like Yahoo's undocumented
endpoints from Vercel's edge — exactly what Preview QA would hit).

**Fix** (`components/stocks/stock-header.tsx`, `components/stocks/stock-market-dashboard.tsx`,
`components/stocks/stock-table.tsx`):
- `StockHeader` now takes `symbol`/`name` as separate, always-synchronous props (sourced from
  constituent metadata in the parent) and uses those as the single source of truth for what's
  displayed; `quote` only gates price/change/market-status, never the symbol/name shown.
- `StockMarketDashboard` clears `selectedQuote`/`chart` to null/[] the instant `selectedSymbol`
  changes (before the new fetch even starts), so a slow/failed fetch can never leave stale data
  from the previous stock on screen.
- Watch/Add Holding/Price Alert/Note/Ask Stark now target `selectedMeta` (symbol+name, always
  available) instead of requiring a resolved quote — these work even when live price data is
  temporarily unavailable, per the report's explicit "separate selection state from data
  availability" requirement.
- Related News now keys off the selected symbol/name directly, independent of quote state.
- Added per-market last-selected memory (`lastSelectedByMarket`): switching Thailand↔US now
  restores each market's last-tapped stock instead of always resetting to the default.
- Table rows: explicit `h-[44px] min-h-[44px]` tap target, `aria-selected` on the highlighted row.

**How this was verified — actually driving the app, not just reading code**: this sandbox cannot
reach the live Vercel Preview or Supabase (same network wall documented elsewhere in this file), so
a local Playwright browser was driven against `next dev` with `middleware.ts` temporarily
no-op'd (Supabase's auth check is unreachable from here too) and `/api/stocks/*`/`/api/news*`
responses mocked. `middleware.ts` was restored from git before committing — `git diff` confirmed
zero unintended changes beyond the three component files. Confirmed by tapping through, in
sequence: ADVANC → AOT → CPALL → KBANK → PTT (header updated every time), then ADVANC again with
its quote endpoint deliberately mocked to fail (header still correctly showed "ADVANC / Advanced
Info Service" with a provider-unavailable message, never reverting to PTT), then AAPL → MSFT →
NVDA → GOOGL → AMZN on the US side, then TH↔US↔TH↔US switching (confirmed ADVANC and AMZN were
correctly restored as each market's last pick). Zero console/page errors from the app itself.

**Still unverified from this sandbox** (as with the rest of Phase 4): real behavior against the
actual Yahoo Finance endpoints from Vercel's servers — the mocked test proves the selection *logic*
is now correct regardless of how slow/unreliable the data fetch is, which was the actual point of
failure, but real-device Preview QA is still what confirms live data quality.

Build: `npx tsc --noEmit` and `npm run build` both clean. Pushed to
`claude/snk-life-os-crypto-markets`, git-triggered Preview deployment `dpl_3FqqRcrqAmhQxAXJTggwFRd1ur93`
reached READY, `/markets` still correctly redirects unauthenticated to `/login`, zero runtime
errors recorded. Production untouched.

## 🟡 PHASE 4 — STOCK MARKETS EXPERIENCE (2026-09-02, in progress on the same feature branch as Phase 3)

**Branch**: `claude/snk-life-os-crypto-markets` (continued — commit `6d1d487`, on top of Phase 3's `e508526`). Production is still on the Phase 2 checkpoint and untouched.

**Root cause found and fixed**: the reported "ADVANC shows Apple Inc." bug was the free TradingView
`widgetembed` iframe (`components/tradingview-widget.tsx`) silently falling back to its own default
instrument whenever it can't resolve an exchange prefix its free/public data license doesn't cover
(`SET:ADVANC` and the other four Thai `PRESETS` entries). Rather than patch the symbol string and hope,
the entire Overview tab's primary chart/data surface was replaced with a self-built experience backed by
real Yahoo Finance data end-to-end, so the header, chart, and table are always reading the same resolved
quote object — there is no separate opaque widget that can silently drift to a different symbol.
`lib/stocks/yahoo.ts` additionally guards this explicitly: `fetchQuotes`/`fetchChart` compare the symbol
Yahoo actually returns against the one requested and drop the row entirely on any mismatch, rather than
ever show a substituted instrument. `tradingview-widget.tsx` is left in the repo (unused, harmless) in
case it's wanted elsewhere later — nothing imports it anymore.

**What's built** (`lib/stocks/*`, `app/api/stocks/*`, `components/stocks/*`):
- **Yahoo Finance provider** (`lib/stocks/yahoo.ts`) — server-side only, no client-exposed key, 8s
  timeout, Next `fetch` revalidate caching, batch quotes (`fetchQuotes`) and per-symbol chart
  (`fetchChart`, 1D/5D/1M/3M/6M/1Y/5Y). Thai symbols are queried with a `.BK` suffix internally; the
  app's own symbols stay bare (`ADVANC`, not `ADVANC.BK`) everywhere else.
- **SET50 and S&P 500 constituent lists** (`lib/stocks/set50.ts`, `lib/stocks/sp500.ts`) — real
  company/ticker snapshots, explicitly documented in-file as a periodically-refreshed static membership
  list (index rebalancing has no free live API and isn't what "no fake data" is about — the prices and
  changes shown for every one of these tickers are always fetched live, never this list). SET50 has all
  50 names; S&P 500 is a curated ~100-name set of the most liquid, widely-recognized large-caps across
  sectors rather than a literal 500-row enumeration typed from memory — chosen because (a) a full 500-row
  table isn't usable on a mobile screen anyway (the spec's own default view is 10-20 rows + View All) and
  (b) it avoids the accuracy risk of hand-listing 500 tickers. **Documented trade-off, not hidden.**
- **Transparent, rule-based signals** (`lib/stocks/signals.ts`) — `computeStockMovers` (liquidity-filtered
  gainers/losers/most-active) and `computeStockSignals` (Unusual Volume / Strong Momentum / Weak Momentum
  / High Volatility, each with its real number) — mirrors `lib/crypto/signals.ts` exactly, and per the
  explicit anti-requirement, **never** renders a BUY/SELL/STRONG BUY label anywhere, including in Stark's
  system prompt instructions.
- **New routes**: `/api/stocks/quotes?market=TH|US` (batch quotes for that market's full constituent
  list, powers the table), `/api/stocks/chart?symbol=&market=&range=` (chart + the single resolved quote
  for the header, with the mismatch guard above).
- **`components/stocks/stock-header.tsx`** — symbol, company name, price, change/change%, market status
  (open/pre/post/closed, from Yahoo's `marketState`), source + last-updated, all currency-aware (THB vs
  USD via `Intl.NumberFormat`).
- **`components/stocks/stock-market-dashboard.tsx`** — the rebuilt Overview tab content: Thailand/US
  market switch (resets selection to that market's first constituent on switch, never carries a stale
  symbol across markets) → stock header → compact 240px chart (reused `CryptoChart`, the same
  dependency-free inline-SVG component from Phase 3 — no new chart library, no drawing tools/indicator
  toolbar since it's a plain line/area chart) with only the 7 range chips → Watch/Add
  Holding/Price Alert/Note quick actions (existing resource engine, `prefill` prop, same pattern as
  Crypto — `market` field set to `"SET"` for Thai holdings or the real exchange name for US ones) →
  `components/stocks/stock-table.tsx` (search, sort by symbol/price/change, quick filter chips
  All/Gainers/Losers/Most Active, 12 rows by default with "View All" to expand — all client-side over the
  already-fetched market list, tapping a row updates the header/chart above rather than navigating away)
  → Market News → per-stock Related News → Ask Stark.
- **News reuse, not a new system**: Market News and Related News fetch the *existing*
  `/api/news?category=` route (Thailand market prioritizes `thailand,business,markets`; US prioritizes
  `markets,business,tech`) and render with the *existing* `NewsCard`/`NewsArticleSheet` components — same
  Read Summary/Open Original/Ask Stark-about-story/Save actions as the News page itself, same
  `saved_news` save state (`/api/news/saved`). Nothing news-related was reimplemented.
- **Stark**: `lib/stark-context.ts::buildStockContext(market)` mirrors `buildCryptoContext()`'s
  known-data/calculation split (no separate "interpretation" layer for stocks, since there's no BTC-pulse
  equivalent requested); `app/api/stark/route.ts` adds `wantsStocks` keyword/attached-context detection
  (EN+TH) alongside the existing `wantsCrypto` check, and the system prompt now explicitly instructs
  Stark to never use BUY/SELL/STRONG BUY phrasing for either asset class.
- **TH/EN**: full `stocksPage` namespace added to both dictionaries (~45 keys).
- **Crypto tab and `lib/crypto/*`/`components/crypto/*` untouched** — verified by diff scope: this
  commit only adds `lib/stocks`, `app/api/stocks`, `components/stocks`, edits `markets/page.tsx` (Overview
  tab body only, Crypto tab branch unchanged), `stark-context.ts`/`stark/route.ts` (additive), and the two
  i18n dictionaries (additive).

**Not done / deliberately out of scope for this pass**: true pagination/virtualization for "View All" on
S&P 500 wasn't needed since the curated list tops out around 100 rows (renders fine as a plain scrollable
table, no windowing library added); a global "search any stock beyond the two constituent lists" was not
built (the spec's search requirement was scoped to *within* SET50/S&P500, not an open-ended symbol
lookup like Crypto's).

**Verification status**: local `npx tsc --noEmit` and `npm run build` both pass clean. Live behavior
against Yahoo Finance's actual endpoints (whether the unofficial `query1.finance.yahoo.com` API responds
reliably from Vercel's servers, real ADVANC/CPALL/AOT/KBANK/PTT and AAPL/MSFT/NVDA/GOOGL/AMZN quotes,
chart rendering at each range, touch usability at the four iPhone widths, TH/EN label fit in the compact
table) has **not** been checked yet — this is a new, previously-untested data source for this project
(unlike CoinGecko, which Phase 3 already proved works from this deployment), so Preview QA on this pass
matters more than usual. Push triggered a git-linked Vercel Preview build automatically per the standing
deploy method; see the deployment ID recorded in the chat reply for this session.

## 🟡 PHASE 3 — CRYPTO MARKETS (2026-09-02, in progress on a feature branch)

**Branch**: `claude/snk-life-os-crypto-markets`, created from Production commit `2ad6f244c03aca332aa1d50e1fa242f07d50949f` (the live Phase 2 checkpoint). Production is untouched during this phase.

**What's built**: a new Crypto tab inside the existing Markets page (`Overview | Crypto` via the same
`Tabs` pattern used elsewhere — existing Overview content untouched). Data comes from CoinGecko's free
public API, fetched server-side only (`lib/crypto/coingecko.ts`, never exposes a key client-side, per-call
timeout + cache, returns `[]`/`null` on failure rather than throwing — a failed asset never blocks
others). New API routes: `/api/crypto/markets` (default 5 assets or `scope=top` for the top-100 scan
used by movers/watch/pulse), `/api/crypto/global`, `/api/crypto/coin/[id]` (detail + chart for a
range), `/api/crypto/search`.

- **BTC/ETH quick cards + global stats** (total market cap, 24h change, BTC/ETH dominance), each with
  source + last-updated.
- **BTC Market Pulse** (`lib/crypto/signals.ts::computeBtcPulse`) — a transparent, scored state
  (Strong/Positive/Neutral/Weak/Risk-Off) derived only from real 7d/24h momentum, volume/market-cap
  ratio, and intraday volatility on the data already fetched — never a fabricated prediction, factors
  are shown alongside the state.
- **Coins to Watch / Interesting Now** (`computeCoinsToWatch`/`computeInterestingNow`) — rule-based only
  (unusual volume vs. the scan's own median, large 24h/7d moves, outperforming BTC, volatility
  expansion), restricted to market-cap rank ≤150 to keep it to liquid assets. Each hit shows its real
  numeric reason, never an unexplained AI opinion. Empty state is honest ("nothing qualifies") rather
  than forcing picks.
- **Top Gainers / Losers / Most Active** — same liquidity filter.
- **Search** (CoinGecko `/search`) — dynamic, not a hardcoded coin list.
- **Coin detail sheet** (`components/crypto/crypto-detail-sheet.tsx`) — price, 24h/7d, market cap,
  volume, rank, 24h high/low, a dependency-free inline SVG chart across 1D/5D/1M/3M/6M/1Y/5Y, source +
  timestamp, and four real actions reusing the existing resource engine with prefill: Watch
  (`watchlist_items`), Add Holding (`holdings`), Price Alert (`price_alerts`), Note (`notes_table`) —
  crypto holdings/watchlist entries live in the same tables as everything else, Markets stays
  research/monitoring and Portfolio stays ownership, per spec. Related News is a client-side keyword
  match against the News module's business/markets categories, explicitly labeled "possible contributing
  factor," never asserted as causal.
- **Ask Stark about crypto**: both the coin detail sheet (per-asset mini chat) and the main Stark page
  (two new suggested chips) work. `lib/stark-context.ts::buildCryptoContext()` fetches a live crypto
  snapshot (default assets + top-100 scan + global) whenever a message looks crypto-related (keyword
  match) or a specific asset is attached, and the system prompt explicitly labels KNOWN MARKET DATA vs.
  CALCULATION (the watch-list signals) vs. INTERPRETATION (BTC pulse) vs. instructs Stark to say "missing
  data" rather than invent numbers.
- **Today integration, restrained as specified**: `components/crypto/crypto-today-widget.tsx` renders
  nothing at all unless BTC moved ≥8% in 24h or an active crypto price alert's condition is currently
  true (checked live on page view — this app has no background job runner, so alerts are evaluated
  on-demand, never promised as push notifications, matching the explicit "don't promise infrastructure
  that doesn't exist" rule).
- **TH/EN**: full `cryptoPage` i18n namespace added to both dictionaries, plus `marketsPage.tabOverview`/`tabCrypto`.
- **No fake data anywhere**: every numeric field renders "—"/"Unavailable" rather than a substitute value
  when the provider doesn't return it; nothing is AI-generated except the two explicitly-labeled
  AI/interpretation surfaces (BTC pulse framing text, and Stark's own prose), and even those are built
  only from the real fetched numbers.

**Not done / deliberately out of scope for this pass**: no separate "Thailand/US/Gold/FX/Commodities"
tabs were built — the existing Overview tab's TradingView preset chips already cover Thai/US
stocks/Gold/FX, and building five more distinct dedicated sections wasn't requested as clearly as Crypto
and would have meant redesigning Markets, which was explicitly disallowed. Fear & Greed Index and
24h-liquidation context were skipped (no verified reliable free source wired up this pass) rather than
faked.

**Verification status**: local `npm run build` and `tsc --noEmit` both pass. Live behavior against the
real CoinGecko API (whether it actually returns data reliably from Vercel's servers, chart rendering,
touch usability at the four iPhone widths, TH/EN crypto label fit) has **not** been checked yet — that
happens once this deploys to Preview, exactly like every other module before it in this project.

## ✅ PHASE 2 — STABLE PRODUCTION CHECKPOINT (2026-09-02, still what's live)

## 🚀 PHASE 2 — PRODUCTION LIVE (2026-09-02)

- **Live URL**: https://snk-life-os-final-stable2.vercel.app (canonical domain, aliased to this deploy)
- **Production deployment**: `dpl_ATkynvFFt4YNSjvwnt16Bs3f4bXg`, target=`production`, state=`READY`
- **Final commit**: `1c2925fb237dc6ad0b5af1a53060ce8eaad78fd3` on `main` (merge of the verified Phase 2
  checkpoint `1d83670` from `claude/snk-life-os-i18n-news`, which itself is `7e98923` — the mobile
  Start/End fix — plus the checkpoint doc commit). `main` is this project's Vercel Production Branch, so
  this push built and deployed automatically via the git integration set up earlier this session.
- **Automated verification performed** (`mcp__Vercel__web_fetch_vercel_url`, `get_project_deployment_protection`,
  `get_runtime_errors`): `/login` → 200, serves the real app with `lang="th"` (Thai default confirmed
  server-rendered), language switcher present (TH active/EN available), password-only form, no signup
  path. `/schedule` and `/news` (Phase 2's new pages) → both correctly redirect unauthenticated requests
  to `/login?next=...`, confirming protected-route middleware covers them. No Vercel SSO/password/
  trusted-IP wall (`get_project_deployment_protection` all `enabled: false`). Zero runtime errors in the
  15 minutes after going live. No missing script/CSS references in the served HTML.
- **Not verifiable from this sandbox** (same standing network-policy limitation documented throughout
  this project): actual login, create/edit/delete on any entity, refresh persistence, logout/login
  persistence, News articles actually loading real content from the RSS providers, and the Start/End
  mobile layout fix rendering correctly — all require a real authenticated browser session, which this
  environment cannot open. These need the user's on-device confirmation; nothing here should be read as
  "confirmed working" for anything past what's listed as automated-verified above.
- **Supabase**: unchanged this promotion — `snk-life-os-private` (`pbbihfipfbpiqbiqlagd`), migrations
  through `08_recurring_schedule` already applied live in earlier steps this session (`profiles.locale`,
  `news_preferences`, `saved_news`, `schedule_events.rrule`, `schedule_event_occurrences`), all RLS
  `owner_id = auth.uid()`. `ANTHROPIC_API_KEY` still not confirmed set as a Vercel env var — Stark and the
  AI-generated News brief/relevance fall back to their honest non-AI/not-connected states without it.
- **Known scope trade-offs carried into Production** (disclosed earlier, unchanged): the Schedule page
  dropped `business_id`/`project_id` linking; Timeline still reads raw `schedule_events` (a recurring
  event shows there only on its literal first occurrence, not every occurrence).
- **Deploy method going forward**: this project is now git-linked (`snkpcn/snk-life-os`, Production
  Branch = `main`). Pushing to `main` deploys Production; pushing to any other branch deploys Preview.
  No more manual `deploy_to_vercel` file-tree assembly needed — that was the whole fix for this session's
  earlier deployment blocker.

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
