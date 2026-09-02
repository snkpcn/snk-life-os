import type { AiProvider } from "./types";

const ENV_VAR = "GEMINI_API_KEY";
const MAX_TOKENS = 700;
// A live test under real Google-side high-demand (503) hung well past 60s with no timeout —
// the other providers' raw-fetch calls don't need one since they haven't shown this failure
// mode. Aborts cleanly into the same graceful-error path instead of hanging the request.
const TIMEOUT_MS = 20000;

// Stark is a daily chief-of-staff assistant, not a heavy reasoning tool — this stays on the
// cheap/low-quota Flash-Lite tier by design. GEMINI_MODEL overrides this entirely (single
// explicit choice, skips the fallback chain). Otherwise, try the preferred model first and
// only fall further down this SAME tier (never a "-pro" or other expensive model) if Google's
// API says the preferred one genuinely isn't available to this key/account (a 404 "not found /
// no longer available" response) — never for a transient 429/503/timeout, since retrying a
// different model won't fix a quota or capacity problem and just burns more quota.
const MODEL_CANDIDATES = ["gemini-3.1-flash-lite", "gemini-2.0-flash-lite", "gemini-flash-lite-latest"];

async function requestOnce(model: string, apiKey: string, system: string, messages: { role: string; content: string }[]): Promise<{ ok: true; text: string } | { ok: false; status: number; bodyText: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: MAX_TOKENS },
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error(`Google Gemini request timed out after ${TIMEOUT_MS}ms (model: ${model})`);
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    return { ok: false, status: res.status, bodyText };
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text || "").join("") : "";
  return { ok: true, text };
}

function looksLikeModelUnavailable(status: number, bodyText: string): boolean {
  return status === 404 && /no longer available|not found/i.test(bodyText);
}

export const googleProvider: AiProvider = {
  id: "google",
  label: "Google (Gemini)",
  envVar: ENV_VAR,

  isConfigured() {
    return Boolean(process.env[ENV_VAR]);
  },

  async chat(system, messages) {
    const apiKey = process.env[ENV_VAR];
    if (!apiKey) throw new Error(`${ENV_VAR} not set`);

    const explicitModel = process.env.GEMINI_MODEL;
    const candidates = explicitModel ? [explicitModel] : MODEL_CANDIDATES;

    let lastFailure: { status: number; bodyText: string; model: string } | null = null;
    for (const model of candidates) {
      const result = await requestOnce(model, apiKey, system, messages);
      if (result.ok) return result.text;
      lastFailure = { status: result.status, bodyText: result.bodyText, model };
      if (!looksLikeModelUnavailable(result.status, result.bodyText)) break;
      // else: this model specifically doesn't exist for this account — try the next
      // same-tier candidate rather than surfacing a confusing 404 to the user.
    }

    throw new Error(`Google Gemini request failed (${lastFailure!.status}, model: ${lastFailure!.model}): ${lastFailure!.bodyText.slice(0, 200)}`);
  },
};
