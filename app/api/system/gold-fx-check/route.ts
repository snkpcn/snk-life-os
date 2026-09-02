import { NextResponse } from "next/server";
import { fetchRawInstrumentQuote, fetchRawInstrumentChart } from "@/lib/stocks/yahoo";
import { GOLD_YAHOO_SYMBOL, USDTHB_YAHOO_SYMBOL, USDTHB_DISPLAY_SYMBOL, USDTHB_DISPLAY_NAME } from "@/lib/gold-fx/constants";

export const dynamic = "force-dynamic";

async function rawProbe(yahooSymbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=5d&interval=1d`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; SNKLifeOS/1.0)" }, cache: "no-store" });
    const bodyText = await res.text();
    return { ok: res.ok, status: res.status, bodyPreview: bodyText.slice(0, 500) };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) };
  }
}

const GOLD_SYMBOL_CANDIDATES = ["GC=F", "XAUUSD=X", "XAU=X", "MGC=F"];

// TEMPORARY, UNAUTHENTICATED — used once to confirm real Gold/USD-THB data reaches this
// deployment (same data-fetch functions the real /api/markets/gold and /api/markets/fx
// routes use, which stay auth-gated). Removed before this branch ships.
export async function GET() {
  const [chart, usdThb, usdThbProbe, ...goldCandidateProbes] = await Promise.all([
    fetchRawInstrumentChart(GOLD_YAHOO_SYMBOL, "1M"),
    fetchRawInstrumentQuote(USDTHB_YAHOO_SYMBOL, USDTHB_DISPLAY_SYMBOL, USDTHB_DISPLAY_NAME, "THB"),
    rawProbe(USDTHB_YAHOO_SYMBOL),
    ...GOLD_SYMBOL_CANDIDATES.map((sym) => rawProbe(sym)),
  ]);

  const goldCandidates = GOLD_SYMBOL_CANDIDATES.map((sym, i) => ({ symbol: sym, ...goldCandidateProbes[i] }));

  return NextResponse.json({
    goldChartPoints: chart.length,
    usdThb,
    usdThbProbe,
    goldCandidates,
  });
}
