import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchQuotes } from "@/lib/stocks/yahoo";
import { SET50 } from "@/lib/stocks/set50";
import { SP500 } from "@/lib/stocks/sp500";
import type { StockMarket } from "@/lib/stocks/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const market = (searchParams.get("market") === "TH" ? "TH" : "US") as StockMarket;
  const symbolsParam = searchParams.get("symbols");

  // Callers should pass only the symbols currently on screen (visible table rows, or a search
  // match) rather than the whole constituent list — this keeps each request small and fast.
  // A bare hit with no `symbols` still works (first 15 of that market) so the endpoint is
  // never unusable on its own, but the client always passes an explicit, small set in practice.
  const requested = symbolsParam ? symbolsParam.split(",").filter(Boolean) : (market === "TH" ? SET50 : SP500).map((c) => c.symbol).slice(0, 15);
  const symbols = requested.slice(0, 60);

  const quotes = await fetchQuotes(symbols, market);
  return NextResponse.json({ quotes, fetched_at: new Date().toISOString(), unavailable: quotes.length === 0 && symbols.length > 0 });
}
