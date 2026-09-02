import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase.from("saved_news").select("*").order("saved_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { error } = await supabase.from("saved_news").insert({
    headline: body.headline,
    source: body.source,
    source_url: body.source_url,
    article_url: body.article_url,
    summary: body.summary,
    category: body.category,
    published_at: body.published_at,
    dedupe_key: body.dedupe_key,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const dedupeKey = searchParams.get("dedupe_key");
  if (!id && !dedupeKey) return NextResponse.json({ error: "Missing id or dedupe_key" }, { status: 400 });

  const query = supabase.from("saved_news").delete();
  const { error } = id ? await query.eq("id", id) : await query.eq("dedupe_key", dedupeKey as string);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
