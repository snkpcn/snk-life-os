// Real Yahoo Finance symbols — not fabricated. "XAUUSD=X" is Yahoo's spot gold (troy ounce,
// USD) FX-style ticker; "THB=X" is Yahoo's convention for USD/THB (base USD, quote THB).
export const GOLD_YAHOO_SYMBOL = "XAUUSD=X";
export const GOLD_DISPLAY_SYMBOL = "XAU/USD";
export const GOLD_DISPLAY_NAME = "Gold Spot";

export const USDTHB_YAHOO_SYMBOL = "THB=X";
export const USDTHB_DISPLAY_SYMBOL = "USD/THB";
export const USDTHB_DISPLAY_NAME = "US Dollar / Thai Baht";

const TROY_OUNCE_GRAMS = 31.1034768;
const THAI_BAHT_WEIGHT_GRAMS = 15.244;

/** Indicative-only Thai gold price per baht-weight, derived from XAU/USD × USD/THB.
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
