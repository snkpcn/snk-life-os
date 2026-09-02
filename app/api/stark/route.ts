import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildStarkContext, buildCryptoContext, buildStockContext, languageInstruction } from "@/lib/stark-context";
import type { StockMarket } from "@/lib/stocks/types";

export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ArticleContext = { headline: string; source: string; summary: string; published_at: string | null; article_url: string };
type CryptoAskContext = { id: string; symbol: string; name: string; price: number | null; change24h: number | null; change7d: number | null; marketCap: number | null; marketCapRank: number | null };
type StockAskContext = { symbol: string; name: string; market: StockMarket; price: number | null; changePercent: number | null; currency: string };
type InstrumentAskContext = { symbol: string; name: string; price: number | null; changePercent: number | null; currency: string };

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
  const stockAsk: StockAskContext | undefined = body.stock;
  const instrumentAsk: InstrumentAskContext | undefined = body.instrument;

  const wantsCrypto =
    Boolean(cryptoAsk) ||
    /crypto|bitcoin|btc|ethereum|eth|coin|คริปโต|เหรียญ/i.test(message) ||
    history.some((m) => /crypto|bitcoin|btc|ethereum|eth|coin|คริปโต|เหรียญ/i.test(m.content));

  const wantsStocks =
    Boolean(stockAsk) ||
    /stock|share|equity|set50|s&p|nasdaq|nyse|หุ้น|ตลาดหลักทรัพย์/i.test(message) ||
    history.some((m) => /stock|share|equity|set50|s&p|nasdaq|nyse|หุ้น|ตลาดหลักทรัพย์/i.test(m.content));

  const [context, cryptoContext, stockContext] = await Promise.all([
    buildStarkContext(supabase),
    wantsCrypto ? buildCryptoContext() : Promise.resolve(""),
    wantsStocks ? buildStockContext(stockAsk?.market || "TH") : Promise.resolve(""),
  ]);

  const articleBlock = article
    ? `\n\nThe user is asking about this news article — answer only from what is given here, never invent facts beyond it:\nHEADLINE: ${article.headline}\nSOURCE: ${article.source}\nPUBLISHED: ${article.published_at || "unknown"}\nSUMMARY: ${article.summary}\nURL: ${article.article_url}`
    : "";

  const cryptoAskBlock = cryptoAsk
    ? `\n\nThe user is asking about this specific crypto asset — answer only from the CRYPTO context above plus these known facts, never invent numbers:\n${cryptoAsk.name} (${cryptoAsk.symbol}): price $${cryptoAsk.price ?? "unknown"}, 24h ${cryptoAsk.change24h ?? "?"}%, 7d ${cryptoAsk.change7d ?? "?"}%, market cap $${cryptoAsk.marketCap ?? "?"}, rank #${cryptoAsk.marketCapRank ?? "?"}`
    : "";

  const stockAskBlock = stockAsk
    ? `\n\nThe user is asking about this specific stock — answer only from the STOCK MARKET context above plus these known facts, never invent numbers:\n${stockAsk.name} (${stockAsk.symbol}, ${stockAsk.market === "TH" ? "SET" : "US"}): price ${stockAsk.price ?? "unknown"} ${stockAsk.currency}, change ${stockAsk.changePercent ?? "?"}%`
    : "";

  const instrumentAskBlock = instrumentAsk
    ? `\n\nThe user is asking about this specific instrument (a commodity or FX rate, not a stock or crypto) — answer only from these known facts, never invent numbers, and if a Thai-baht-equivalent gold value is mentioned anywhere, always call it an indicative/estimated conversion, never the official Gold Traders Association of Thailand price:\n${instrumentAsk.name} (${instrumentAsk.symbol}): price ${instrumentAsk.price ?? "unknown"} ${instrumentAsk.currency}, change ${instrumentAsk.changePercent ?? "?"}%`
    : "";

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 700,
    system: `You are Stark, the executive chief-of-staff inside SNK LIFE OS. Answer only from the live data snapshot provided below — never invent numbers. If something isn't in the snapshot, say it's not tracked yet and suggest where to add it. Be direct, concise, and action-oriented. Never use labels like BUY/SELL/STRONG BUY for stocks or crypto — describe momentum, volume, and volatility factually instead. ${languageInstruction(locale)}\n\n${context}${cryptoContext ? `\n\n${cryptoContext}` : ""}${stockContext ? `\n\n${stockContext}` : ""}${articleBlock}${cryptoAskBlock}${stockAskBlock}${instrumentAskBlock}`,
    messages: [...history.map((m) => ({ role: m.role, content: m.content })), { role: "user" as const, content: message }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const reply = textBlock && "text" in textBlock ? textBlock.text : "…";

  return NextResponse.json({ reply });
}
