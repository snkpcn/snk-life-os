import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider } from "./types";

const ENV_VAR = "ANTHROPIC_API_KEY";
const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 700;

export const anthropicProvider: AiProvider = {
  id: "anthropic",
  label: "Anthropic (Claude)",
  envVar: ENV_VAR,

  isConfigured() {
    return Boolean(process.env[ENV_VAR]);
  },

  async chat(system, messages) {
    const apiKey = process.env[ENV_VAR];
    if (!apiKey) throw new Error(`${ENV_VAR} not set`);

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock && "text" in textBlock ? textBlock.text : "";
  },
};
