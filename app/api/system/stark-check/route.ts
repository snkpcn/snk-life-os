import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

// TEMPORARY, UNAUTHENTICATED — used once to confirm ANTHROPIC_API_KEY is actually set and
// working on this deployment, without ever exposing its value. Removed before this branch
// ships. Never returns the key itself or any raw error text that could echo it.
export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const keyPresent = Boolean(apiKey);

  if (!keyPresent) {
    return NextResponse.json({ keyPresent: false, testCallSucceeded: false });
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8,
      messages: [{ role: "user", content: "Reply with exactly one word: ok" }],
    });
    return NextResponse.json({ keyPresent: true, testCallSucceeded: true });
  } catch (err: any) {
    // Only a whitelisted, non-sensitive summary — never err.message verbatim (some SDK error
    // strings can quote request headers) and never anything derived from the key value.
    const status = typeof err?.status === "number" ? err.status : null;
    const category = status === 401 ? "invalid_key" : status === 429 ? "rate_limited" : status ? `http_${status}` : "network_or_unknown";
    return NextResponse.json({ keyPresent: true, testCallSucceeded: false, failureCategory: category });
  }
}
