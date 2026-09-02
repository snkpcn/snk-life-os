import type { AiProvider } from "./types";

const ENV_VAR = "GEMINI_API_KEY";
// gemini-2.0-flash was retired — confirmed via a live 404 from Google's own API naming its
// replacement. Override with GEMINI_MODEL if this one is retired too.
const DEFAULT_MODEL = "gemini-3.6-flash";
const MAX_TOKENS = 700;
// A live test under real Google-side high-demand (503) hung well past 60s with no timeout —
// the other providers' raw-fetch calls don't need one since they haven't shown this failure
// mode. Aborts cleanly into the same graceful-error path instead of hanging the request.
const TIMEOUT_MS = 20000;

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
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

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
      if (err?.name === "AbortError") throw new Error(`Google Gemini request timed out after ${TIMEOUT_MS}ms`);
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new Error(`Google Gemini request failed (${res.status}): ${bodyText.slice(0, 200)}`);
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    return Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text || "").join("") : "";
  },
};
