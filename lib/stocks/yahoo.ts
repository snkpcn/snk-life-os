import type { StockChartPoint, StockChartRange, StockMarket, StockQuote } from "./types";
import { CHART_RANGE_PARAMS } from "./types";

const SOURCE = "Yahoo Finance";
const TIMEOUT_MS = 8000;

function yahooSymbol(symbol: string, market: StockMarket): string {
  return market === "TH" ? `${symbol}.BK` : symbol;
}

async function fetchJson(url: string, revalidate: number): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate },
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SNKLifeOS/1.0)" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function marketStateOf(raw: string | undefined): StockQuote["marketState"] {
  switch (raw) {
    case "REGULAR":
      return "open";
    case "CLOSED":
      return "closed";
    case "PRE":
      return "pre";
    case "POST":
      return "post";
    default:
      return "unknown";
  }
}

/** Batch quote fetch. Never throws — a symbol Yahoo can't resolve is simply omitted, never
 * substituted with an unrelated instrument. */
export async function fetchQuotes(symbols: string[], market: StockMarket): Promise<StockQuote[]> {
  if (symbols.length === 0) return [];
  const yahooSymbols = symbols.map((s) => yahooSymbol(s, market));
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSymbols.join(","))}`;
  const data = await fetchJson(url, 60);
  const rows: any[] = data?.quoteResponse?.result;
  if (!Array.isArray(rows)) return [];
  const now = new Date().toISOString();

  const bySymbol = new Map<string, any>();
  for (const row of rows) {
    if (row?.symbol) bySymbol.set(String(row.symbol).toUpperCase(), row);
  }

  const out: StockQuote[] = [];
  for (const symbol of symbols) {
    const row = bySymbol.get(yahooSymbol(symbol, market).toUpperCase());
    if (!row) continue;
    // Guard against Yahoo resolving to an unexpected instrument (wrong exchange/ticker drift).
    const returnedSymbol = String(row.symbol || "").toUpperCase();
    const expected = yahooSymbol(symbol, market).toUpperCase();
    if (returnedSymbol !== expected) continue;

    out.push({
      symbol,
      market,
      name: row.longName || row.shortName || symbol,
      price: typeof row.regularMarketPrice === "number" ? row.regularMarketPrice : null,
      change: typeof row.regularMarketChange === "number" ? row.regularMarketChange : null,
      changePercent: typeof row.regularMarketChangePercent === "number" ? row.regularMarketChangePercent : null,
      dayHigh: typeof row.regularMarketDayHigh === "number" ? row.regularMarketDayHigh : null,
      dayLow: typeof row.regularMarketDayLow === "number" ? row.regularMarketDayLow : null,
      volume: typeof row.regularMarketVolume === "number" ? row.regularMarketVolume : null,
      marketCap: typeof row.marketCap === "number" ? row.marketCap : null,
      currency: row.currency || (market === "TH" ? "THB" : "USD"),
      exchange: row.fullExchangeName || row.exchange || null,
      marketState: marketStateOf(row.marketState),
      source: SOURCE,
      updatedAt: now,
    });
  }
  return out;
}

export async function fetchQuote(symbol: string, market: StockMarket): Promise<StockQuote | null> {
  const rows = await fetchQuotes([symbol], market);
  return rows[0] || null;
}

/** Chart fetch for one symbol. Returns [] on any failure — the caller shows an honest empty
 * chart state rather than a fabricated line. */
export async function fetchChart(symbol: string, market: StockMarket, range: StockChartRange): Promise<StockChartPoint[]> {
  const params = CHART_RANGE_PARAMS[range];
  const ySymbol = yahooSymbol(symbol, market);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?range=${params.range}&interval=${params.interval}`;
  const data = await fetchJson(url, 120);
  const result = data?.chart?.result?.[0];
  if (!result) return [];

  const returnedSymbol = String(result?.meta?.symbol || "").toUpperCase();
  if (returnedSymbol && returnedSymbol !== ySymbol.toUpperCase()) return [];

  const timestamps: number[] = result.timestamp || [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];
  const points: StockChartPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const price = closes[i];
    if (typeof price === "number" && Number.isFinite(price)) {
      points.push({ t: timestamps[i] * 1000, price });
    }
  }
  return points;
}
