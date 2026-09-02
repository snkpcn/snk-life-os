import type { CryptoAsset, CryptoChartPoint, CryptoGlobal } from "./types";

const BASE = "https://api.coingecko.com/api/v3";
const SOURCE = "CoinGecko";
const TIMEOUT_MS = 8000;

export const DEFAULT_COIN_IDS = ["bitcoin", "ethereum", "solana", "binancecoin", "ripple"];

async function fetchJson(url: string, revalidate: number): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal, next: { revalidate } });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function normalizeMarketRow(row: any, updatedAt: string): CryptoAsset {
  return {
    id: row.id,
    symbol: String(row.symbol || "").toUpperCase(),
    name: row.name,
    image: row.image || null,
    price: typeof row.current_price === "number" ? row.current_price : null,
    change24h: typeof row.price_change_percentage_24h_in_currency === "number" ? row.price_change_percentage_24h_in_currency : typeof row.price_change_percentage_24h === "number" ? row.price_change_percentage_24h : null,
    change7d: typeof row.price_change_percentage_7d_in_currency === "number" ? row.price_change_percentage_7d_in_currency : null,
    volume24h: typeof row.total_volume === "number" ? row.total_volume : null,
    marketCap: typeof row.market_cap === "number" ? row.market_cap : null,
    marketCapRank: typeof row.market_cap_rank === "number" ? row.market_cap_rank : null,
    high24h: typeof row.high_24h === "number" ? row.high_24h : null,
    low24h: typeof row.low_24h === "number" ? row.low_24h : null,
    source: SOURCE,
    updatedAt,
  };
}

/** Fetches market data for specific coin ids. Returns [] on any failure — never throws. */
export async function fetchMarketsByIds(ids: string[]): Promise<CryptoAsset[]> {
  if (ids.length === 0) return [];
  const url = `${BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(ids.join(","))}&order=market_cap_desc&per_page=${ids.length}&page=1&sparkline=false&price_change_percentage=24h,7d`;
  const data = await fetchJson(url, 60);
  if (!Array.isArray(data)) return [];
  const now = new Date().toISOString();
  return data.map((row) => normalizeMarketRow(row, now));
}

/** Fetches a page of the top N coins by market cap — used for movers / coins-to-watch / interesting-now scans. */
export async function fetchTopMarkets(perPage = 100): Promise<CryptoAsset[]> {
  const url = `${BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=1&sparkline=false&price_change_percentage=24h,7d`;
  const data = await fetchJson(url, 120);
  if (!Array.isArray(data)) return [];
  const now = new Date().toISOString();
  return data.map((row) => normalizeMarketRow(row, now));
}

export async function fetchGlobal(): Promise<CryptoGlobal | null> {
  const data = await fetchJson(`${BASE}/global`, 120);
  const d = data?.data;
  if (!d) return null;
  return {
    totalMarketCap: typeof d.total_market_cap?.usd === "number" ? d.total_market_cap.usd : null,
    totalMarketCapChange24h: typeof d.market_cap_change_percentage_24h_usd === "number" ? d.market_cap_change_percentage_24h_usd : null,
    btcDominance: typeof d.market_cap_percentage?.btc === "number" ? d.market_cap_percentage.btc : null,
    ethDominance: typeof d.market_cap_percentage?.eth === "number" ? d.market_cap_percentage.eth : null,
    source: SOURCE,
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchCoinDetail(id: string): Promise<CryptoAsset | null> {
  const data = await fetchJson(`${BASE}/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`, 60);
  const md = data?.market_data;
  if (!data || !md) return null;
  const now = new Date().toISOString();
  return {
    id: data.id,
    symbol: String(data.symbol || "").toUpperCase(),
    name: data.name,
    image: data.image?.small || data.image?.thumb || null,
    price: typeof md.current_price?.usd === "number" ? md.current_price.usd : null,
    change24h: typeof md.price_change_percentage_24h === "number" ? md.price_change_percentage_24h : null,
    change7d: typeof md.price_change_percentage_7d === "number" ? md.price_change_percentage_7d : null,
    volume24h: typeof md.total_volume?.usd === "number" ? md.total_volume.usd : null,
    marketCap: typeof md.market_cap?.usd === "number" ? md.market_cap.usd : null,
    marketCapRank: typeof md.market_cap_rank === "number" ? md.market_cap_rank : null,
    high24h: typeof md.high_24h?.usd === "number" ? md.high_24h.usd : null,
    low24h: typeof md.low_24h?.usd === "number" ? md.low_24h.usd : null,
    source: SOURCE,
    updatedAt: now,
  };
}

export async function fetchChart(id: string, days: number): Promise<CryptoChartPoint[]> {
  const data = await fetchJson(`${BASE}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}`, 300);
  const prices = data?.prices;
  if (!Array.isArray(prices)) return [];
  return prices.map((p: [number, number]) => ({ t: p[0], price: p[1] }));
}

export type CoinSearchResult = { id: string; symbol: string; name: string; thumb: string | null; marketCapRank: number | null };

export async function searchCoins(query: string): Promise<CoinSearchResult[]> {
  if (!query.trim()) return [];
  const data = await fetchJson(`${BASE}/search?query=${encodeURIComponent(query)}`, 300);
  const coins = data?.coins;
  if (!Array.isArray(coins)) return [];
  return coins.slice(0, 15).map((c: any) => ({
    id: c.id,
    symbol: String(c.symbol || "").toUpperCase(),
    name: c.name,
    thumb: c.thumb || null,
    marketCapRank: typeof c.market_cap_rank === "number" ? c.market_cap_rank : null,
  }));
}
