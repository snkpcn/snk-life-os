import { createClient } from "@/lib/supabase/server";
import { todayRange } from "@/lib/date-range";
import { fetchMarketsByIds, fetchTopMarkets, fetchGlobal, DEFAULT_COIN_IDS } from "@/lib/crypto/coingecko";
import { computeBtcPulse, computeCoinsToWatch } from "@/lib/crypto/signals";

export async function buildStarkContext(supabase: ReturnType<typeof createClient>) {
  const { startISO, endISO, dateOnly } = todayRange();
  const monthStart = `${dateOnly.slice(0, 7)}-01`;

  const [
    { data: topTasks },
    { data: overdueTasks },
    { data: events },
    { data: projects },
    { data: goals },
    { data: monthTx },
    { data: assets },
    { data: debts },
  ] = await Promise.all([
    supabase.from("tasks").select("title, status, priority").eq("is_today_priority", true).is("archived_at", null),
    supabase
      .from("tasks")
      .select("title, due_date")
      .neq("status", "done")
      .is("archived_at", null)
      .lt("due_date", dateOnly)
      .limit(10),
    supabase
      .from("schedule_events")
      .select("title, start_time")
      .is("archived_at", null)
      .gte("start_time", startISO)
      .lt("start_time", endISO),
    supabase
      .from("projects")
      .select("name, status, next_action, blocker, explicit_progress")
      .is("archived_at", null)
      .order("priority", { ascending: true })
      .limit(8),
    supabase.from("goals").select("title, status, current_value, target_value, unit").is("archived_at", null).limit(8),
    supabase.from("transactions").select("type, amount").is("archived_at", null).gte("occurred_at", monthStart),
    supabase.from("assets").select("value").is("archived_at", null),
    supabase.from("debts").select("balance").is("archived_at", null),
  ]);

  const income = (monthTx || []).filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = (monthTx || []).filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const totalAssets = (assets || []).reduce((s, a) => s + Number(a.value), 0);
  const totalDebts = (debts || []).reduce((s, d) => s + Number(d.balance), 0);

  return `Live SNK LIFE OS data snapshot (do not invent numbers beyond this; say "unknown" if asked about something not listed here):

TOP 3 TODAY: ${(topTasks || []).map((t) => `${t.title} [${t.status}]`).join("; ") || "none set"}
OVERDUE TASKS: ${(overdueTasks || []).map((t) => `${t.title} (due ${t.due_date})`).join("; ") || "none"}
TODAY'S SCHEDULE: ${(events || []).map((e) => e.title).join("; ") || "nothing scheduled"}
ACTIVE PROJECTS: ${(projects || [])
    .map((p) => `${p.name} [${p.status}, ${p.explicit_progress ?? "?"}%] next: ${p.next_action || "—"}${p.blocker ? ` blocker: ${p.blocker}` : ""}`)
    .join(" | ") || "none"}
GOALS: ${(goals || []).map((g) => `${g.title} [${g.status}] ${g.current_value ?? "?"}/${g.target_value ?? "?"} ${g.unit || ""}`).join("; ") || "none"}
MONEY (this month): income ${income}, expense ${expense}. Total assets ${totalAssets}, total debts ${totalDebts}, net worth ${totalAssets - totalDebts}.`;
}

/** Live crypto snapshot for Stark, clearly separating fetched facts, derived calculations, and the one
 * labeled interpretation (BTC pulse) — never fabricated, degrades to "no data" per-asset on provider failure. */
export async function buildCryptoContext(): Promise<string> {
  const [defaults, top, global] = await Promise.all([fetchMarketsByIds(DEFAULT_COIN_IDS), fetchTopMarkets(100), fetchGlobal()]);

  if (defaults.length === 0 && top.length === 0) {
    return "CRYPTO DATA: currently unavailable from the market data provider — say so plainly if asked, do not invent any crypto numbers.";
  }

  const btc = defaults.find((a) => a.symbol === "BTC") || null;
  const pulse = computeBtcPulse(btc);
  const watchList = top.length > 0 ? computeCoinsToWatch(top, btc?.change7d ?? null).slice(0, 5) : [];

  const knownData = defaults
    .map((a) => `${a.name} (${a.symbol}): $${a.price ?? "unknown"}, 24h ${a.change24h ?? "?"}%, 7d ${a.change7d ?? "?"}%, market cap $${a.marketCap ?? "?"}, rank #${a.marketCapRank ?? "?"}`)
    .join("\n");

  const globalLine = global
    ? `Total crypto market cap $${global.totalMarketCap ?? "?"} (24h ${global.totalMarketCapChange24h ?? "?"}%), BTC dominance ${global.btcDominance ?? "?"}%, ETH dominance ${global.ethDominance ?? "?"}%.`
    : "Global market stats unavailable.";

  const calc =
    watchList.length > 0
      ? watchList.map((s) => `${s.asset.symbol}: ${s.reasons.map((r) => `${r.key}=${r.value}`).join(", ")}`).join("\n")
      : "No coins currently meet the watch-list thresholds.";

  return `CRYPTO — KNOWN MARKET DATA (source: CoinGecko, fetched just now):
${knownData}
${globalLine}

CRYPTO — CALCULATION (rule-based "coins to watch" signals derived from the data above — unusual volume, strong 24h/7d moves, outperforming BTC, volatility; NOT an AI opinion):
${calc}

CRYPTO — INTERPRETATION (BTC Market Pulse — an analytical label derived from the momentum/volume/volatility numbers above, NOT a buy/sell recommendation): ${pulse.state.toUpperCase()} (factors: ${pulse.factors.join(", ") || "none"})

When answering crypto questions, clearly distinguish which of these three categories (known data / calculation / interpretation) your answer draws from, and say "missing data" for anything not covered above rather than inventing a number.`;
}

export function languageInstruction(locale: string | undefined) {
  if (locale === "th") {
    return "Respond in Thai (ภาษาไทย) by default, since the app's current language is Thai. If the user writes to you in a different language, you may naturally reply in that language instead. Never mistranslate the user's own stored data (task titles, business names, notes, etc.) — always quote it exactly as stored.";
  }
  return "Respond in English by default, since the app's current language is English. If the user writes to you in a different language, you may naturally reply in that language instead. Never mistranslate the user's own stored data (task titles, business names, notes, etc.) — always quote it exactly as stored.";
}
