import type { AiProvider } from "./types";

const ENV_VAR = "OPENAI_API_KEY";
const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_TOKENS = 700;

// Raw HTTP, not the openai SDK — keeps this project's dependency footprint unchanged (only
// @anthropic-ai/sdk was installed before this abstraction) and OpenAI's chat completions
// shape is stable enough not to need a client library for one endpoint.
export const openaiProvider: AiProvider = {
  id: "openai",
  label: "OpenAI",
  envVar: ENV_VAR,

  isConfigured() {
    return Boolean(process.env[ENV_VAR]);
  },

  async chat(system, messages) {
    const apiKey = process.env[ENV_VAR];
    if (!apiKey) throw new Error(`${ENV_VAR} not set`);
    const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
      throw new Error(`OpenAI request failed (${res.status}): ${bodyText.slice(0, 200)}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  },
};
