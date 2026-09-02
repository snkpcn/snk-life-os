import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchMarketsByIds, fetchTopMarkets, DEFAULT_COIN_IDS } from "@/lib/crypto/coingecko";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");
  const scope = searchParams.get("scope");
  const limit = Math.min(250, Math.max(1, Number(searchParams.get("limit")) || 100));

  const assets =
    scope === "top"
      ? await fetchTopMarkets(limit)
      : await fetchMarketsByIds(idsParam ? idsParam.split(",").filter(Boolean) : DEFAULT_COIN_IDS);

  return NextResponse.json({ assets, fetched_at: new Date().toISOString(), unavailable: assets.length === 0 });
}
