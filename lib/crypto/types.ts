export type CryptoAsset = {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  price: number | null;
  change24h: number | null;
  change7d: number | null;
  volume24h: number | null;
  marketCap: number | null;
  marketCapRank: number | null;
  high24h: number | null;
  low24h: number | null;
  source: string;
  updatedAt: string;
};

export type CryptoGlobal = {
  totalMarketCap: number | null;
  totalMarketCapChange24h: number | null;
  btcDominance: number | null;
  ethDominance: number | null;
  source: string;
  updatedAt: string;
};

export type CryptoChartPoint = { t: number; price: number };

export type CryptoChartRange = "1D" | "5D" | "1M" | "3M" | "6M" | "1Y" | "5Y";

export const CHART_RANGE_DAYS: Record<CryptoChartRange, number> = {
  "1D": 1,
  "5D": 5,
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  "5Y": 1825,
};

export type WatchReasonKey =
  | "unusualVolume"
  | "strong24h"
  | "strong7d"
  | "outperformingBtc"
  | "underperformingBtc"
  | "volatile";

export type CoinSignal = {
  asset: CryptoAsset;
  reasons: { key: WatchReasonKey; value: string }[];
};

export type BtcPulseState = "strong" | "positive" | "neutral" | "weak" | "risk_off";

export type BtcPulse = {
  state: BtcPulseState;
  factors: string[];
};
