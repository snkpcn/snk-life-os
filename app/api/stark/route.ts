import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildStarkContext, languageInstruction } from "@/lib/stark-context";

export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ArticleContext = { headline: string; source: string; summary: string; published_at: string | null; article_url: string };

function notConnectedMessage(locale: string | undefined) {
  if (locale === "th") {
    return "สตาร์กยังไม่ได้เชื่อมต่อ — ยังไม่ได้ตั้งค่าตัวแปรสภาพแวดล้อม ANTHROPIC_API_KEY บนดีพลอยนี้ กรุณาเพิ่มในการตั้งค่าโปรเจกต์ของ Vercel แล้วผมจะตอบจากข้อมูลจริงของคุณได้";
  }
  return "Stark isn't connected yet — the ANTHROPIC_API_KEY environment variable hasn't been set on this deployment. Add it in Vercel project settings, then I'll answer from your live data.";
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const locale: string | undefined = body.locale === "th" ? "th" : "en";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ reply: notConnectedMessage(locale) });
  }

  const message: string = body.message || "";
  const history: ChatMessage[] = Array.isArray(body.history) ? body.history.slice(-10) : [];
  const article: ArticleContext | undefined = body.article;

  const context = await buildStarkContext(supabase);

  const articleBlock = article
    ? `\n\nThe user is asking about this news article — answer only from what is given here, never invent facts beyond it:\nHEADLINE: ${article.headline}\nSOURCE: ${article.source}\nPUBLISHED: ${article.published_at || "unknown"}\nSUMMARY: ${article.summary}\nURL: ${article.article_url}`
    : "";

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 700,
    system: `You are Stark, the executive chief-of-staff inside SNK LIFE OS. Answer only from the live data snapshot provided below — never invent numbers. If something isn't in the snapshot, say it's not tracked yet and suggest where to add it. Be direct, concise, and action-oriented. ${languageInstruction(locale)}\n\n${context}${articleBlock}`,
    messages: [...history.map((m) => ({ role: m.role, content: m.content })), { role: "user" as const, content: message }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const reply = textBlock && "text" in textBlock ? textBlock.text : "…";

  return NextResponse.json({ reply });
}
