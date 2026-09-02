import type { StockChartPoint, StockChartRange, StockMarket, StockQuote } from "./types";
import { CHART_RANGE_PARAMS } from "./types";

const SOURCE = "Yahoo Finance";
const TIMEOUT_MS = 8000;
const QUOTE_CHUNK_SIZE = 15;
const MAX_CONCURRENCY = 6;

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

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Runs async jobs with a concurrency cap — never fires more than `limit` requests at once,
 * so a large symbol list can't hammer the provider or the caller's own outbound connection pool. */
async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function runner() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
  return results;
}

function normalizeV7Row(row: any, symbol: string, market: StockMarket, now: string): StockQuote {
  return {
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
  };
}

/** One chunk of the v7 batch-quote endpoint. Returns a Map keyed by the exact Yahoo symbol it
 * asked for (only entries Yahoo actually confirmed by echoing the same symbol back) — never
 * throws, an empty Map means "ask the per-symbol fallback for all of these instead." */
async function fetchV7Chunk(yahooSymbols: string[]): Promise<Map<string, any>> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSymbols.join(","))}`;
  const data = await fetchJson(url, 45);
  const rows: any[] = data?.quoteResponse?.result;
  const bySymbol = new Map<string, any>();
  if (!Array.isArray(rows)) return bySymbol;
  for (const row of rows) {
    const returned = String(row?.symbol || "").toUpperCase();
    if (returned) bySymbol.set(returned, row);
  }
  return bySymbol;
}

/** Single-symbol fallback, sourced from the v8 chart endpoint's `meta` block — this is the
 * same endpoint the chart itself uses, so it's a second, independent way to get a real quote
 * when the v7 batch endpoint fails or omits a symbol. change/changePercent are only computed
 * when Yahoo actually returned both a live price and a previous close — never estimated. */
async function fetchQuoteFromChartMeta(symbol: string, market: StockMarket): Promise<StockQuote | null> {
  const ySymbol = yahooSymbol(symbol, market);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?range=5d&interval=1d`;
  const data = await fetchJson(url, 45);
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) return null;

  const returnedSymbol = String(meta.symbol || "").toUpperCase();
  if (returnedSymbol && returnedSymbol !== ySymbol.toUpperCase()) return null;

  const price = typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : null;
  const previousClose = typeof meta.previousClose === "number" ? meta.previousClose : typeof meta.chartPreviousClose === "number" ? meta.chartPreviousClose : null;
  const change = price !== null && previousClose !== null ? price - previousClose : null;
  const changePercent = change !== null && previousClose !== null && previousClose !== 0 ? (change / previousClose) * 100 : null;

  return {
    symbol,
    market,
    name: meta.longName || meta.shortName || symbol,
    price,
    change,
    changePercent,
    dayHigh: typeof meta.regularMarketDayHigh === "number" ? meta.regularMarketDayHigh : null,
    dayLow: typeof meta.regularMarketDayLow === "number" ? meta.regularMarketDayLow : null,
    volume: typeof meta.regularMarketVolume === "number" ? meta.regularMarketVolume : null,
    marketCap: null,
    currency: meta.currency || (market === "TH" ? "THB" : "USD"),
    exchange: meta.fullExchangeName || meta.exchangeName || null,
    marketState: marketStateOf(meta.marketState),
    source: SOURCE,
    updatedAt: new Date().toISOString(),
  };
}

/** Batch quote fetch: chunks the symbol list against the v7 endpoint (primary, efficient for
 * many symbols) with a concurrency cap, then falls back to the per-symbol chart-meta endpoint
 * (also concurrency-capped) only for symbols the primary pass didn't return. A symbol that
 * fails both is simply omitted — the caller shows "Unavailable" for that one row, never a
 * substituted instrument, and never lets one bad symbol blank out the whole table. */
export async function fetchQuotes(symbols: string[], market: StockMarket): Promise<StockQuote[]> {
  if (symbols.length === 0) return [];
  const now = new Date().toISOString();
  const chunks = chunk(symbols, QUOTE_CHUNK_SIZE);

  const chunkMaps = await runWithConcurrency(chunks, MAX_CONCURRENCY, (symbolChunk) => fetchV7Chunk(symbolChunk.map((s) => yahooSymbol(s, market))));

  const out: StockQuote[] = [];
  const missing: string[] = [];
  let chunkIndex = 0;
  for (const symbolChunk of chunks) {
    const bySymbol = chunkMaps[chunkIndex++];
    for (const symbol of symbolChunk) {
      const expected = yahooSymbol(symbol, market).toUpperCase();
      const row = bySymbol.get(expected);
      if (row) {
        out.push(normalizeV7Row(row, symbol, market, now));
      } else {
        missing.push(symbol);
      }
    }
  }

  if (missing.length > 0) {
    const fallbackResults = await runWithConcurrency(missing, MAX_CONCURRENCY, (symbol) => fetchQuoteFromChartMeta(symbol, market));
    for (const quote of fallbackResults) {
      if (quote) out.push(quote);
    }
  }

  return out;
}

export async function fetchQuote(symbol: string, market: StockMarket): Promise<StockQuote | null> {
  const rows = await fetchQuotes([symbol], market);
  return rows[0] || null;
}

/** Chart + quote for one symbol in a single request — the v8 chart endpoint's `meta` block
 * already carries a full real-time quote alongside the price series, so the detail view never
 * needs a second round-trip to the v7 endpoint. Returns [] for the chart on any failure — the
 * caller shows an honest empty chart state rather than a fabricated line. */
export async function fetchChart(symbol: string, market: StockMarket, range: StockChartRange): Promise<StockChartPoint[]> {
  const params = CHART_RANGE_PARAMS[range];
  const ySymbol = yahooSymbol(symbol, market);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?range=${params.range}&interval=${params.interval}`;
  const data = await fetchJson(url, 90);
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

/** Detail-view quote — always sourced from the chart endpoint's own meta block (see
 * `fetchQuoteFromChartMeta`), never the v7 batch endpoint, so opening a single stock's detail
 * never depends on the same request that can fail across a whole batch. */
export async function fetchDetailQuote(symbol: string, market: StockMarket): Promise<StockQuote | null> {
  return fetchQuoteFromChartMeta(symbol, market);
}

/** A quote for a raw Yahoo symbol with no `.BK`/market suffix logic — used for FX pairs and
 * commodities (e.g. "XAUUSD=X", "THB=X"), which aren't equities and don't belong to a
 * StockMarket ("TH"/"US"). Kept separate from the stock-quote functions above so nothing about
 * the working stock-quote path changes. */
export type RawInstrumentQuote = {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  currency: string;
  exchange: string | null;
  marketState: StockQuote["marketState"];
  source: string;
  updatedAt: string;
};

export async function fetchRawInstrumentQuote(yahooSymbol: string, displaySymbol: string, displayName: string, fallbackCurrency: string): Promise<RawInstrumentQuote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=5d&interval=1d`;
  const data = await fetchJson(url, 45);
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) return null;

  const returnedSymbol = String(meta.symbol || "").toUpperCase();
  if (returnedSymbol && returnedSymbol !== yahooSymbol.toUpperCase()) return null;

  const price = typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : null;
  const previousClose = typeof meta.previousClose === "number" ? meta.previousClose : typeof meta.chartPreviousClose === "number" ? meta.chartPreviousClose : null;
  const change = price !== null && previousClose !== null ? price - previousClose : null;
  const changePercent = change !== null && previousClose !== null && previousClose !== 0 ? (change / previousClose) * 100 : null;

  return {
    symbol: displaySymbol,
    name: displayName,
    price,
    change,
    changePercent,
    dayHigh: typeof meta.regularMarketDayHigh === "number" ? meta.regularMarketDayHigh : null,
    dayLow: typeof meta.regularMarketDayLow === "number" ? meta.regularMarketDayLow : null,
    currency: meta.currency || fallbackCurrency,
    exchange: meta.fullExchangeName || meta.exchangeName || null,
    marketState: marketStateOf(meta.marketState),
    source: SOURCE,
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchRawInstrumentChart(yahooSymbol: string, range: StockChartRange): Promise<StockChartPoint[]> {
  const params = CHART_RANGE_PARAMS[range];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=${params.range}&interval=${params.interval}`;
  const data = await fetchJson(url, 90);
  const result = data?.chart?.result?.[0];
  if (!result) return [];

  const returnedSymbol = String(result?.meta?.symbol || "").toUpperCase();
  if (returnedSymbol && returnedSymbol !== yahooSymbol.toUpperCase()) return [];

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
