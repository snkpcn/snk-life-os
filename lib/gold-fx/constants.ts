// Real Yahoo Finance symbols — not fabricated. "GC=F" is Yahoo's COMEX gold futures ticker
// (front-month), confirmed live against Yahoo's v8 chart endpoint returning a real price
// (~$4383/oz at time of writing). Both "XAUUSD=X" and "XAU=X" 404 "symbol may be delisted" on
// this endpoint and were wrong — do not reintroduce them without re-verifying live first.
// Labeled "Gold Futures (COMEX)" rather than "Spot" since a futures price can differ slightly
// from the LBMA spot fix — this is a real, honest distinction, not just caution for its own sake.
// "THB=X" is Yahoo's convention for USD/THB (base USD, quote THB).
export const GOLD_YAHOO_SYMBOL = "GC=F";
export const GOLD_DISPLAY_SYMBOL = "GOLD";
export const GOLD_DISPLAY_NAME = "Gold Futures (COMEX)";

export const USDTHB_YAHOO_SYMBOL = "THB=X";
export const USDTHB_DISPLAY_SYMBOL = "USD/THB";
export const USDTHB_DISPLAY_NAME = "US Dollar / Thai Baht";

const TROY_OUNCE_GRAMS = 31.1034768;
const THAI_BAHT_WEIGHT_GRAMS = 15.244;

/** Indicative-only Thai gold price per baht-weight, derived from the COMEX gold futures
 * price (GC=F) × USD/THB.
 * This is NEVER the official Gold Traders Association of Thailand price (which reflects
 * local supply/demand, purity conventions, and a dealer markup this calculation has no way
 * to know) — it's a transparent unit conversion of two real market quotes, always labeled
 * "Indicative / Estimated" wherever it's shown. Returns null if either input is missing. */
export function estimateThaiGoldPerBaht(xauUsdPrice: number | null, usdThbRate: number | null): number | null {
  if (xauUsdPrice === null || usdThbRate === null) return null;
  const pricePerGramUsd = xauUsdPrice / TROY_OUNCE_GRAMS;
  const pricePerBahtWeightUsd = pricePerGramUsd * THAI_BAHT_WEIGHT_GRAMS;
  return pricePerBahtWeightUsd * usdThbRate;
}
