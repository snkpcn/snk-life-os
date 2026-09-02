import type { StockQuote } from "./types";

const LIQUID_MIN_VOLUME = 10_000;

function isLiquid(q: StockQuote) {
  return q.volume !== null && q.volume >= LIQUID_MIN_VOLUME && q.price !== null;
}

export type StockMovers = { gainers: StockQuote[]; losers: StockQuote[]; mostActive: StockQuote[] };

/** Top gainers/losers/most-active, restricted to liquid quotes only. */
export function computeStockMovers(quotes: StockQuote[]): StockMovers {
  const liquid = quotes.filter(isLiquid);
  const withChange = liquid.filter((q) => q.changePercent !== null);
  const gainers = [...withChange].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0)).slice(0, 10);
  const losers = [...withChange].sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0)).slice(0, 10);
  const mostActive = [...liquid].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 10);
  return { gainers, losers, mostActive };
}

export type StockSignalKey = "unusualVolume" | "strongMomentum" | "weakMomentum" | "highVolatility";

export type StockSignal = { quote: StockQuote; reasons: { key: StockSignalKey; value: string }[] };

function medianVolume(quotes: StockQuote[]): number {
  const vols = quotes.filter((q) => q.volume !== null).map((q) => q.volume as number).sort((a, b) => a - b);
  if (vols.length === 0) return 0;
  return vols[Math.floor(vols.length / 2)];
}

/** Transparent, rule-based descriptive signals — never a BUY/SELL/STRONG BUY label, only a
 * factual, sourced reason (unusual volume, strong or weak momentum, high volatility). */
export function computeStockSignals(quotes: StockQuote[]): StockSignal[] {
  const liquid = quotes.filter(isLiquid);
  const medVol = medianVolume(liquid);
  const results: StockSignal[] = [];

  for (const q of liquid) {
    const reasons: { key: StockSignalKey; value: string }[] = [];

    if (q.volume !== null && medVol > 0 && q.volume >= medVol * 2.5) {
      reasons.push({ key: "unusualVolume", value: (q.volume / medVol).toFixed(1) });
    }
    if (q.changePercent !== null && q.changePercent >= 3) {
      reasons.push({ key: "strongMomentum", value: q.changePercent.toFixed(2) });
    }
    if (q.changePercent !== null && q.changePercent <= -3) {
      reasons.push({ key: "weakMomentum", value: q.changePercent.toFixed(2) });
    }
    if (q.dayHigh !== null && q.dayLow !== null && q.price !== null && q.price > 0) {
      const range = ((q.dayHigh - q.dayLow) / q.price) * 100;
      if (range >= 4) reasons.push({ key: "highVolatility", value: range.toFixed(2) });
    }

    if (reasons.length > 0) results.push({ quote: q, reasons });
  }

  results.sort((a, b) => b.reasons.length - a.reasons.length || (b.quote.volume ?? 0) - (a.quote.volume ?? 0));
  return results.slice(0, 8);
}
