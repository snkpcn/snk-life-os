import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchRawInstrumentQuote, fetchRawInstrumentChart } from "@/lib/stocks/yahoo";
import { GOLD_YAHOO_SYMBOL, GOLD_DISPLAY_SYMBOL, GOLD_DISPLAY_NAME, USDTHB_YAHOO_SYMBOL, estimateThaiGoldPerBaht } from "@/lib/gold-fx/constants";
import type { StockChartRange } from "@/lib/stocks/types";

export const dynamic = "force-dynamic";

const VALID_RANGES: StockChartRange[] = ["1D", "5D", "1M", "3M", "6M", "1Y", "5Y"];

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const rangeParam = searchParams.get("range") as StockChartRange | null;
  const range = rangeParam && VALID_RANGES.includes(rangeParam) ? rangeParam : "1M";

  const [quote, chart, usdThbQuote] = await Promise.all([
    fetchRawInstrumentQuote(GOLD_YAHOO_SYMBOL, GOLD_DISPLAY_SYMBOL, GOLD_DISPLAY_NAME, "USD"),
    fetchRawInstrumentChart(GOLD_YAHOO_SYMBOL, range),
    fetchRawInstrumentQuote(USDTHB_YAHOO_SYMBOL, "USD/THB", "US Dollar / Thai Baht", "THB"),
  ]);

  const thaiGoldIndicativePerBaht = estimateThaiGoldPerBaht(quote?.price ?? null, usdThbQuote?.price ?? null);

  return NextResponse.json({
    quote,
    chart,
    thaiGoldIndicative: thaiGoldIndicativePerBaht !== null ? { pricePerBahtWeightTHB: thaiGoldIndicativePerBaht, isIndicative: true } : null,
    fetched_at: new Date().toISOString(),
  });
}
