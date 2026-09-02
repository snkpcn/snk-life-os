import type { AiProvider } from "./types";

const ENV_VAR = "OPENROUTER_API_KEY";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const MAX_TOKENS = 700;

// OpenRouter is an aggregator (one key, many underlying models) — useful as a fallback
// option for anyone who already has an OpenRouter key from another project.
export const openrouterProvider: AiProvider = {
  id: "openrouter",
  label: "OpenRouter",
  envVar: ENV_VAR,

  isConfigured() {
    return Boolean(process.env[ENV_VAR]);
  },

  async chat(system, messages) {
    const apiKey = process.env[ENV_VAR];
    if (!apiKey) throw new Error(`${ENV_VAR} not set`);
    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new Error(`OpenRouter request failed (${res.status}): ${bodyText.slice(0, 200)}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  },
};
