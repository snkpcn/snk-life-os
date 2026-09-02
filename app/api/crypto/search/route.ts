import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchCoins } from "@/lib/crypto/coingecko";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const results = await searchCoins(q);
  return NextResponse.json({ results });
}
