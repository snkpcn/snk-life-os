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

// Diagnostic-only: gemini-3.6-flash is consistently 503/timing out (real, external Google
// capacity issue, not our code) — probe a few alternative real Gemini model names directly to
// find one actually reachable right now, before assuming the whole provider is unusable.
const MODEL_CANDIDATES = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-pro-latest"];

async function probeModel(model: string, apiKey: string): Promise<{ model: string; ok: boolean; status?: number; bodyPreview?: string; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with exactly one word: ok" }] }] }),
      signal: controller.signal,
    });
    const bodyText = await res.text().catch(() => "");
    return { model, ok: res.ok, status: res.status, bodyPreview: bodyText.slice(0, 150) };
  } catch (err: any) {
    return { model, ok: false, error: err?.name === "AbortError" ? "timeout" : String(err?.message || err).slice(0, 150) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const provider = getConfiguredProvider();
  const [th, en] = await Promise.all([runCheck("th"), runCheck("en")]);

  const apiKey = process.env.GEMINI_API_KEY;
  const modelProbes = apiKey ? await Promise.all(MODEL_CANDIDATES.map((m) => probeModel(m, apiKey))) : [];

  return NextResponse.json({ providerId: provider?.id ?? null, th, en, modelProbes });
}
