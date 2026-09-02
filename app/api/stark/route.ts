import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildStarkContext, buildCryptoContext, languageInstruction } from "@/lib/stark-context";

export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ArticleContext = { headline: string; source: string; summary: string; published_at: string | null; article_url: string };
type CryptoAskContext = { id: string; symbol: string; name: string; price: number | null; change24h: number | null; change7d: number | null; marketCap: number | null; marketCapRank: number | null };

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
  const cryptoAsk: CryptoAskContext | undefined = body.crypto;

  const wantsCrypto =
    Boolean(cryptoAsk) ||
    /crypto|bitcoin|btc|ethereum|eth|coin|คริปโต|เหรียญ/i.test(message) ||
    history.some((m) => /crypto|bitcoin|btc|ethereum|eth|coin|คริปโต|เหรียญ/i.test(m.content));

  const [context, cryptoContext] = await Promise.all([buildStarkContext(supabase), wantsCrypto ? buildCryptoContext() : Promise.resolve("")]);

  const articleBlock = article
    ? `\n\nThe user is asking about this news article — answer only from what is given here, never invent facts beyond it:\nHEADLINE: ${article.headline}\nSOURCE: ${article.source}\nPUBLISHED: ${article.published_at || "unknown"}\nSUMMARY: ${article.summary}\nURL: ${article.article_url}`
    : "";

  const cryptoAskBlock = cryptoAsk
    ? `\n\nThe user is asking about this specific crypto asset — answer only from the CRYPTO context above plus these known facts, never invent numbers:\n${cryptoAsk.name} (${cryptoAsk.symbol}): price $${cryptoAsk.price ?? "unknown"}, 24h ${cryptoAsk.change24h ?? "?"}%, 7d ${cryptoAsk.change7d ?? "?"}%, market cap $${cryptoAsk.marketCap ?? "?"}, rank #${cryptoAsk.marketCapRank ?? "?"}`
    : "";

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 700,
    system: `You are Stark, the executive chief-of-staff inside SNK LIFE OS. Answer only from the live data snapshot provided below — never invent numbers. If something isn't in the snapshot, say it's not tracked yet and suggest where to add it. Be direct, concise, and action-oriented. ${languageInstruction(locale)}\n\n${context}${cryptoContext ? `\n\n${cryptoContext}` : ""}${articleBlock}${cryptoAskBlock}`,
    messages: [...history.map((m) => ({ role: m.role, content: m.content })), { role: "user" as const, content: message }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const reply = textBlock && "text" in textBlock ? textBlock.text : "…";

  return NextResponse.json({ reply });
}
