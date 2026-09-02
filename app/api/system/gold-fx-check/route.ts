import { NextResponse } from "next/server";
import { fetchRawInstrumentQuote, fetchRawInstrumentChart } from "@/lib/stocks/yahoo";
import { GOLD_YAHOO_SYMBOL, GOLD_DISPLAY_SYMBOL, GOLD_DISPLAY_NAME, USDTHB_YAHOO_SYMBOL, USDTHB_DISPLAY_SYMBOL, USDTHB_DISPLAY_NAME, estimateThaiGoldPerBaht } from "@/lib/gold-fx/constants";

export const dynamic = "force-dynamic";

// TEMPORARY, UNAUTHENTICATED — used once to confirm real Gold/USD-THB data reaches this
// deployment (same data-fetch functions the real /api/markets/gold and /api/markets/fx
// routes use, which stay auth-gated). Removed before this branch ships.
export async function GET() {
  const [gold, chart, usdThb] = await Promise.all([
    fetchRawInstrumentQuote(GOLD_YAHOO_SYMBOL, GOLD_DISPLAY_SYMBOL, GOLD_DISPLAY_NAME, "USD"),
    fetchRawInstrumentChart(GOLD_YAHOO_SYMBOL, "1M"),
    fetchRawInstrumentQuote(USDTHB_YAHOO_SYMBOL, USDTHB_DISPLAY_SYMBOL, USDTHB_DISPLAY_NAME, "THB"),
  ]);

  const thaiGoldIndicativePerBaht = estimateThaiGoldPerBaht(gold?.price ?? null, usdThb?.price ?? null);

  return NextResponse.json({
    gold,
    goldChartPoints: chart.length,
    usdThb,
    thaiGoldIndicative: thaiGoldIndicativePerBaht !== null ? { pricePerBahtWeightTHB: thaiGoldIndicativePerBaht, isIndicative: true } : null,
  });
}
