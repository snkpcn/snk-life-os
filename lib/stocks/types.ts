export type StockMarket = "TH" | "US";

export type StockQuote = {
  symbol: string;
  market: StockMarket;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  marketCap: number | null;
  currency: string;
  exchange: string | null;
  marketState: "open" | "closed" | "pre" | "post" | "unknown";
  source: string;
  updatedAt: string;
};

export type StockChartPoint = { t: number; price: number };

export type StockChartRange = "1D" | "5D" | "1M" | "3M" | "6M" | "1Y" | "5Y";

export const CHART_RANGE_PARAMS: Record<StockChartRange, { range: string; interval: string }> = {
  "1D": { range: "1d", interval: "5m" },
  "5D": { range: "5d", interval: "15m" },
  "1M": { range: "1mo", interval: "1d" },
  "3M": { range: "3mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1wk" },
  "5Y": { range: "5y", interval: "1wk" },
};

export type ConstituentMeta = { symbol: string; name: string; sector?: string };
