import { NextResponse } from "next/server";
import { getConfiguredProvider, SUPPORTED_PROVIDERS } from "@/lib/ai";

export const dynamic = "force-dynamic";

// TEMPORARY, UNAUTHENTICATED — verifies the real deployed behavior of Stark's provider
// abstraction: which provider (if any) is configured, and — only if one is — that a real
// minimal chat call actually succeeds. Never returns a key value. Removed once verified.
export async function GET() {
  const provider = getConfiguredProvider();

  if (!provider) {
    return NextResponse.json({
      configured: false,
      supportedProviders: SUPPORTED_PROVIDERS,
    });
  }

  try {
    const reply = await provider.chat("Reply with exactly one short sentence confirming you are connected.", [
      { role: "user", content: "Are you connected?" },
    ]);
    return NextResponse.json({
      configured: true,
      providerId: provider.id,
      testCallSucceeded: true,
      replyPreview: reply.slice(0, 200),
    });
  } catch (err: any) {
    return NextResponse.json({
      configured: true,
      providerId: provider.id,
      testCallSucceeded: false,
      errorPreview: String(err?.message || err).slice(0, 200),
    });
  }
}
