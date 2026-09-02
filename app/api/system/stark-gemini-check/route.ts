import { NextResponse } from "next/server";
import { getConfiguredProvider } from "@/lib/ai";
import { languageInstruction } from "@/lib/stark-context";

export const dynamic = "force-dynamic";

// TEMPORARY, UNAUTHENTICATED — verifies the real Gemini provider integration end-to-end
// against the live deployment, using the EXACT same system-prompt assembly and provider.chat()
// call the real /api/stark route uses. Cannot exercise the real authenticated route directly
// (this sandbox cannot establish a Supabase login session), so it substitutes a synthetic,
// clearly-fake "data snapshot" for the real buildStarkContext() output — everything else
// (locale instruction, system-prompt shape, provider selection) is identical to production
// code. Never returns a key value. Removed once verified.
const FAKE_CONTEXT = `SNK LIFE OS DATA SNAPSHOT (TEST FIXTURE — NOT REAL USER DATA):
- Active project codename: NEBULA-7
- Today's top task: "Ship the quarterly board deck"
- Cash on hand: 42,000 THB`;

async function runCheck(locale: "th" | "en") {
  const provider = getConfiguredProvider();
  if (!provider) return { configured: false };

  const systemPrompt = `You are Stark, the executive chief-of-staff inside SNK LIFE OS. Answer only from the live data snapshot provided below — never invent numbers. Be direct, concise, and action-oriented. ${languageInstruction(locale)}\n\n${FAKE_CONTEXT}`;

  try {
    const reply = await provider.chat(systemPrompt, [
      { role: "user", content: "What is the active project codename in my data snapshot, and what is my top task today?" },
    ]);
    return { configured: true, providerId: provider.id, testCallSucceeded: true, reply };
  } catch (err: any) {
    return { configured: true, providerId: provider.id, testCallSucceeded: false, errorPreview: String(err?.message || err).slice(0, 300) };
  }
}

export async function GET() {
  const provider = getConfiguredProvider();
  const [th, en] = await Promise.all([runCheck("th"), runCheck("en")]);
  return NextResponse.json({ providerId: provider?.id ?? null, th, en });
}
