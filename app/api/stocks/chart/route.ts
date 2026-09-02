import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchChart, fetchDetailQuote } from "@/lib/stocks/yahoo";
import type { StockChartRange, StockMarket } from "@/lib/stocks/types";

export const dynamic = "force-dynamic";

const VALID_RANGES: StockChartRange[] = ["1D", "5D", "1M", "3M", "6M", "1Y", "5Y"];

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const market = (searchParams.get("market") === "TH" ? "TH" : "US") as StockMarket;
  const rangeParam = searchParams.get("range") as StockChartRange | null;
  const range = rangeParam && VALID_RANGES.includes(rangeParam) ? rangeParam : "1M";

  if (!symbol) return NextResponse.json({ error: "symbol is required" }, { status: 400 });

  const [quote, chart] = await Promise.all([fetchDetailQuote(symbol, market), fetchChart(symbol, market, range)]);

  return NextResponse.json({ quote, chart, range, fetched_at: new Date().toISOString() });
}
