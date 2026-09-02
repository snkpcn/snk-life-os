export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

/** One backend Stark can talk to. Each provider owns exactly one required env var — the
 * abstraction never requires more than one credential per provider, and never any provider
 * specifically (Stark works with whichever one is configured, or none). */
export interface AiProvider {
  id: string;
  label: string;
  envVar: string;
  isConfigured(): boolean;
  /** Sends one chat turn and returns the assistant's reply text. Throws on any request
   * failure (network, auth, rate limit, malformed response) — the caller is responsible for
   * turning that into a graceful user-facing message; this layer never swallows errors silently. */
  chat(system: string, messages: ChatMessage[]): Promise<string>;
}

export type AiProviderInfo = { id: string; label: string; envVar: string };
