import { NextResponse } from "next/server";
import { routePrivatePersonalEvent } from "@/lib/snk-money/_personal-finance";
import { PfBindingClient, supabaseRpc } from "@/lib/snk-money/_personal-finance-ledger";
import { lineIdHash } from "@/lib/snk-money/_private-crypto";
import { routeLineGroupEvents, verifyLineSignature } from "@/lib/snk-money/webhook.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { replyToLine } from '@/lib/snk-money/line-reply';

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > 2_000_000) return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 });
  const signature = request.headers.get("x-line-signature") ?? undefined;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });

  try {
    if (!verifyLineSignature(rawBody, signature, channelSecret)) {
      return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
    }
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }
    if (payload && typeof payload === "object" && (payload as { action?: string }).action === "probe") {
      const groups = (payload as { groups?: unknown }).groups;
      if (!Array.isArray(groups) || groups.length > 50 || groups.some((entry) => {
        const groupId = entry && typeof entry === "object" ? (entry as { groupId?: unknown }).groupId : null;
        return typeof groupId !== "string" || !groupId.trim() || groupId.length > 256 || /[\u0000-\u001f]/u.test(groupId);
      })) {
        return NextResponse.json({ ok: false, error: "invalid_groups" }, { status: 400 });
      }
      const bindings = new PfBindingClient(supabaseRpc);
      const statuses = await Promise.all(groups.map(async (entry, index) => {
        const groupId = entry && typeof entry === "object" ? (entry as { groupId?: unknown }).groupId : null;
        if (typeof groupId !== "string") throw new Error("validated_group_was_not_string");
        const groupHash = lineIdHash(groupId);
        if (!groupHash) throw new Error("invalid_group");
        const lookup = await bindings.lookup(groupHash);
        return { index, status: lookup.status, system: lookup.status === 'ACTIVE' ? 'snk' : 'unconfigured', scope: lookup.status === 'ACTIVE' ? 'personal' : null };
      }));
      return NextResponse.json({ ok: true, statuses }, { headers: { "Cache-Control": "no-store" } });
    }
    const result = await routeLineGroupEvents({
      rawBody,
      signature,
      channelSecret,
      processEvent: (event: Parameters<typeof routePrivatePersonalEvent>[0]) =>
        routePrivatePersonalEvent(event, replyToLine),
    });
    return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("SNK_PRIVATE_LINE_ROUTE_FAILED", error instanceof Error ? error.message.slice(0, 160) : "unknown");
    // The Tamma gateway treats 5xx as a fail-closed routing result for
    // unbound groups, so a private group never falls through to business code.
    return NextResponse.json({ ok: false, error: "private_route_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
