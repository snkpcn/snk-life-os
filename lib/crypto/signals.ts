import type { BtcPulse, BtcPulseState, CoinSignal, CryptoAsset, CryptoGlobal, WatchReasonKey } from "./types";

const LIQUID_MARKET_CAP_RANK_MAX = 150;

function isLiquid(a: CryptoAsset) {
  return a.marketCapRank !== null && a.marketCapRank <= LIQUID_MARKET_CAP_RANK_MAX && a.volume24h !== null && a.volume24h > 0;
}

export type TopMovers = { gainers: CryptoAsset[]; losers: CryptoAsset[]; mostActive: CryptoAsset[] };

/** Top gainers/losers/most-active, restricted to liquid assets (market-cap rank <= 150 with real volume). */
export function computeTopMovers(assets: CryptoAsset[]): TopMovers {
  const liquid = assets.filter(isLiquid);
  const withChange = liquid.filter((a) => a.change24h !== null);
  const gainers = [...withChange].sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0)).slice(0, 10);
  const losers = [...withChange].sort((a, b) => (a.change24h ?? 0) - (b.change24h ?? 0)).slice(0, 10);
  const mostActive = [...liquid].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0)).slice(0, 10);
  return { gainers, losers, mostActive };
}

function medianVolumeToMcapRatio(assets: CryptoAsset[]): number {
  const ratios = assets
    .filter((a) => a.volume24h !== null && a.marketCap !== null && a.marketCap > 0)
    .map((a) => (a.volume24h as number) / (a.marketCap as number))
    .sort((a, b) => a - b);
  if (ratios.length === 0) return 0;
  return ratios[Math.floor(ratios.length / 2)];
}

/** Transparent, rule-based "worth monitoring" selection — never an AI opinion. Each reason carries the real number behind it. */
export function computeCoinsToWatch(assets: CryptoAsset[], btcChange7d: number | null): CoinSignal[] {
  const liquid = assets.filter(isLiquid);
  const medianRatio = medianVolumeToMcapRatio(liquid);
  const results: CoinSignal[] = [];

  for (const a of liquid) {
    if (a.symbol === "BTC") continue;
    const reasons: { key: WatchReasonKey; value: string }[] = [];
    const ratio = a.volume24h !== null && a.marketCap && a.marketCap > 0 ? a.volume24h / a.marketCap : null;

    if (ratio !== null && medianRatio > 0 && ratio >= medianRatio * 2) {
      reasons.push({ key: "unusualVolume", value: (ratio / medianRatio).toFixed(1) });
    }
    if (a.change24h !== null && Math.abs(a.change24h) >= 8) {
      reasons.push({ key: "strong24h", value: a.change24h.toFixed(1) });
    }
    if (a.change7d !== null && Math.abs(a.change7d) >= 15) {
      reasons.push({ key: "strong7d", value: a.change7d.toFixed(1) });
    }
    if (a.change7d !== null && btcChange7d !== null && a.change7d - btcChange7d >= 10) {
      reasons.push({ key: "outperformingBtc", value: (a.change7d - btcChange7d).toFixed(1) });
    }
    if (a.high24h !== null && a.low24h !== null && a.price !== null && a.price > 0) {
      const range = ((a.high24h - a.low24h) / a.price) * 100;
      if (range >= 8) reasons.push({ key: "volatile", value: range.toFixed(1) });
    }

    if (reasons.length > 0) results.push({ asset: a, reasons });
  }

  results.sort((a, b) => b.reasons.length - a.reasons.length || (b.asset.volume24h ?? 0) - (a.asset.volume24h ?? 0));
  return results.slice(0, 8);
}

/** A stricter subset of computeCoinsToWatch for the compact "Interesting Now" widget — max 5, requires >=2 reasons or one very strong one. */
export function computeInterestingNow(watchList: CoinSignal[]): CoinSignal[] {
  return watchList.filter((s) => s.reasons.length >= 2 || s.reasons.some((r) => (r.key === "strong7d" || r.key === "strong24h") && Number(r.value.replace("-", "")) >= 15)).slice(0, 5);
}

/** Derives a BTC Market Pulse state from real, transparent metrics only — never a directional prediction. */
export function computeBtcPulse(btc: CryptoAsset | null): BtcPulse {
  if (!btc || btc.change24h === null || btc.change7d === null) {
    return { state: "neutral", factors: [] };
  }

  let score = 0;
  const factors: string[] = [];
  const volumeRatio = btc.volume24h !== null && btc.marketCap ? btc.volume24h / btc.marketCap : null;

  if (btc.change7d >= 8) {
    score += 2;
    factors.push(`btc7d:+${btc.change7d.toFixed(1)}`);
  } else if (btc.change7d <= -8) {
    score -= 2;
    factors.push(`btc7d:${btc.change7d.toFixed(1)}`);
  } else {
    factors.push(`btc7d:${btc.change7d >= 0 ? "+" : ""}${btc.change7d.toFixed(1)}`);
  }

  if (btc.change24h >= 3) score += 1;
  else if (btc.change24h <= -3) score -= 1;
  factors.push(`btc24h:${btc.change24h >= 0 ? "+" : ""}${btc.change24h.toFixed(1)}`);

  if (volumeRatio !== null) {
    factors.push(`volumeRatio:${(volumeRatio * 100).toFixed(1)}`);
    if (volumeRatio >= 0.08) score += btc.change7d >= 0 ? 1 : -1;
  }

  if (btc.high24h !== null && btc.low24h !== null && btc.price) {
    const range = ((btc.high24h - btc.low24h) / btc.price) * 100;
    if (range >= 6) factors.push(`volatility:${range.toFixed(1)}`);
  }

  let state: BtcPulseState = "neutral";
  if (score >= 3) state = "strong";
  else if (score >= 1) state = "positive";
  else if (score <= -3) state = "risk_off";
  else if (score <= -1) state = "weak";

  return { state, factors };
}
