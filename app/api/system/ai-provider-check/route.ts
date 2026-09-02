import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// TEMPORARY, UNAUTHENTICATED — used once to discover which AI provider environment variables
// are already configured on this deployment, so Stark's provider abstraction can reuse
// whichever one is actually available instead of assuming Anthropic. Returns ONLY booleans —
// never a key value, never anything derived from one. Removed once the real provider work
// is verified.
const CANDIDATE_ENV_VARS = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "OPENROUTER_API_KEY",
  "GROQ_API_KEY",
  "MISTRAL_API_KEY",
  "COHERE_API_KEY",
  "AZURE_OPENAI_API_KEY",
  "PERPLEXITY_API_KEY",
  "TOGETHER_API_KEY",
  "DEEPSEEK_API_KEY",
  "XAI_API_KEY",
  "FIREWORKS_API_KEY",
  "CEREBRAS_API_KEY",
  "VERCEL_AI_GATEWAY_API_KEY",
  "AI_GATEWAY_API_KEY",
];

export async function GET() {
  const presence: Record<string, boolean> = {};
  for (const key of CANDIDATE_ENV_VARS) {
    presence[key] = Boolean(process.env[key]);
  }
  return NextResponse.json({ presence });
}
