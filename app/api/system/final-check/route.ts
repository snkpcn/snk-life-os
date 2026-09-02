import { NextResponse } from "next/server";
import { getConfiguredProvider } from "@/lib/ai";
import { fetchRawInstrumentQuote } from "@/lib/stocks/yahoo";
import { fetchQuotes } from "@/lib/stocks/yahoo";
import { GOLD_YAHOO_SYMBOL, GOLD_DISPLAY_SYMBOL, GOLD_DISPLAY_NAME, USDTHB_YAHOO_SYMBOL, USDTHB_DISPLAY_SYMBOL, USDTHB_DISPLAY_NAME } from "@/lib/gold-fx/constants";

export const dynamic = "force-dynamic";

// TEMPORARY, UNAUTHENTICATED — final closeout verification, combined into one route to
// minimize redeploy cycles and outbound API calls (Gemini quota especially). Checks Gold/FX/
// Stocks real data (unchanged this round, quick reconfirmation) and runs the ONE real Gemini
// Stark request required for final sign-off. Never returns a key value. Removed once verified.
const FAKE_CONTEXT = `SNK LIFE OS DATA SNAPSHOT (TEST FIXTURE — NOT REAL USER DATA):
TOP 3 TODAY: Ship the quarterly board deck [in_progress]; Call the accountant [todo]
TODAY'S SCHEDULE: Team standup 09:00; Gym - Chest Workout 18:00`;

export async function GET() {
  const [gold, usdThb, thStock, usStock] = await Promise.all([
    fetchRawInstrumentQuote(GOLD_YAHOO_SYMBOL, GOLD_DISPLAY_SYMBOL, GOLD_DISPLAY_NAME, "USD"),
    fetchRawInstrumentQuote(USDTHB_YAHOO_SYMBOL, USDTHB_DISPLAY_SYMBOL, USDTHB_DISPLAY_NAME, "THB"),
    fetchQuotes(["ADVANC"], "TH"),
    fetchQuotes(["AAPL"], "US"),
  ]);

  const provider = getConfiguredProvider();
  let starkTest: any = { configured: false };
  if (provider) {
    const systemPrompt = `You are Stark, the executive chief-of-staff inside SNK LIFE OS. Answer only from the live data snapshot provided below — never invent numbers. Respond in Thai (ภาษาไทย), plain and concise.\n\n${FAKE_CONTEXT}`;
    try {
      const reply = await provider.chat(systemPrompt, [{ role: "user", content: "วันนี้ตารางของฉันมีอะไรบ้าง?" }]);
      starkTest = { configured: true, providerId: provider.id, testCallSucceeded: true, reply };
    } catch (err: any) {
      starkTest = { configured: true, providerId: provider.id, testCallSucceeded: false, errorPreview: String(err?.message || err).slice(0, 300) };
    }
  }

  return NextResponse.json({
    gold,
    usdThb,
    thStock: thStock[0] ?? null,
    usStock: usStock[0] ?? null,
    starkTest,
  });
}
