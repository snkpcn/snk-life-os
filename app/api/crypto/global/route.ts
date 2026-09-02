import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchGlobal } from "@/lib/crypto/coingecko";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const global = await fetchGlobal();
  return NextResponse.json({ global, fetched_at: new Date().toISOString() });
}
