import type { AiProvider } from "./types";

const ENV_VAR = "GEMINI_API_KEY";
const DEFAULT_MODEL = "gemini-2.0-flash";
const MAX_TOKENS = 700;

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

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: MAX_TOKENS },
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new Error(`Google Gemini request failed (${res.status}): ${bodyText.slice(0, 200)}`);
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    return Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text || "").join("") : "";
  },
};
