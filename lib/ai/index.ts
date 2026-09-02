import type { AiProvider, AiProviderInfo } from "./types";
import { anthropicProvider } from "./anthropic";
import { openaiProvider } from "./openai";
import { googleProvider } from "./google";
import { openrouterProvider } from "./openrouter";

export type { ChatMessage, AiProvider, AiProviderInfo } from "./types";

// Priority order when more than one is configured — Anthropic first only because it was this
// app's original provider, so anyone who sets ANTHROPIC_API_KEY later gets identical behavior
// to before this abstraction existed. No provider is required; Stark works with whichever one
// (if any) is configured. To add a provider: implement AiProvider in a new file and add it here.
const PROVIDERS: AiProvider[] = [anthropicProvider, openaiProvider, googleProvider, openrouterProvider];

export const SUPPORTED_PROVIDERS: AiProviderInfo[] = PROVIDERS.map((p) => ({ id: p.id, label: p.label, envVar: p.envVar }));

export function getConfiguredProvider(): AiProvider | null {
  return PROVIDERS.find((p) => p.isConfigured()) ?? null;
}
