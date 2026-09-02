import { NextResponse } from "next/server";
import { fetchRawInstrumentQuote, fetchRawInstrumentChart } from "@/lib/stocks/yahoo";
import { GOLD_YAHOO_SYMBOL, GOLD_DISPLAY_SYMBOL, GOLD_DISPLAY_NAME, USDTHB_YAHOO_SYMBOL, USDTHB_DISPLAY_SYMBOL, USDTHB_DISPLAY_NAME, estimateThaiGoldPerBaht } from "@/lib/gold-fx/constants";

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

// TEMPORARY, UNAUTHENTICATED — used once to confirm real Gold/USD-THB data reaches this
// deployment (same data-fetch functions the real /api/markets/gold and /api/markets/fx
// routes use, which stay auth-gated). Removed before this branch ships.
export async function GET() {
  const [gold, chart, usdThb, goldProbe, usdThbProbe] = await Promise.all([
    fetchRawInstrumentQuote(GOLD_YAHOO_SYMBOL, GOLD_DISPLAY_SYMBOL, GOLD_DISPLAY_NAME, "USD"),
    fetchRawInstrumentChart(GOLD_YAHOO_SYMBOL, "1M"),
    fetchRawInstrumentQuote(USDTHB_YAHOO_SYMBOL, USDTHB_DISPLAY_SYMBOL, USDTHB_DISPLAY_NAME, "THB"),
    rawProbe(GOLD_YAHOO_SYMBOL),
    rawProbe(USDTHB_YAHOO_SYMBOL),
  ]);

  const thaiGoldIndicativePerBaht = estimateThaiGoldPerBaht(gold?.price ?? null, usdThb?.price ?? null);

  return NextResponse.json({
    gold,
    goldChartPoints: chart.length,
    usdThb,
    thaiGoldIndicative: thaiGoldIndicativePerBaht !== null ? { pricePerBahtWeightTHB: thaiGoldIndicativePerBaht, isIndicative: true } : null,
    goldProbe,
    usdThbProbe,
  });
}
