import { NextResponse } from "next/server";
import { fetchQuotes, fetchDetailQuote } from "@/lib/stocks/yahoo";

export const dynamic = "force-dynamic";

// TEMPORARY, UNAUTHENTICATED — used once to verify real Yahoo Finance data reaches this
// deployment's serverless functions, then removed before this branch is considered done.
// Deliberately not gated behind supabase.auth.getUser() so it can be checked directly.
export async function GET() {
  const [thBatch, usBatch, thDetail, usDetail] = await Promise.all([
    fetchQuotes(["ADVANC", "AOT", "CPALL", "KBANK", "PTT"], "TH"),
    fetchQuotes(["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN"], "US"),
    fetchDetailQuote("ADVANC", "TH"),
    fetchDetailQuote("AAPL", "US"),
  ]);

  return NextResponse.json({
    thBatch,
    usBatch,
    thDetailQuote: thDetail,
    usDetailQuote: usDetail,
    fetched_at: new Date().toISOString(),
  });
}
