import { createHash } from "node:crypto";
import type { SlipExtraction } from "./_personal-finance";

const LINE_CONTENT_ENDPOINT = "https://api-data.line.me/v2/bot/message";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function fetchSnkLineImage(messageId: string): Promise<{ bytes: Buffer; mimeType: string; sha256: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  const response = await fetch(`${LINE_CONTENT_ENDPOINT}/${encodeURIComponent(messageId)}/content`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`LINE image fetch failed ${response.status}`);
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_IMAGE_BYTES) throw new Error("snk_image_too_large");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("snk_image_invalid_size");
  const mimeType = (response.headers.get("content-type") || "image/jpeg").split(";")[0].trim().toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) throw new Error("snk_image_unsupported_type");
  return { bytes, mimeType, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export async function extractSnkSlip(bytes: Buffer, mimeType: string): Promise<SlipExtraction> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("SNK slip extraction is not configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const dataUrl = `data:${mimeType};base64,${bytes.toString("base64")}`;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        instructions: "Extract only visible facts from this personal payment slip or receipt in Thailand. Never infer purpose or invent values. Buddhist year dates must be converted to Gregorian. Return JSON with document_type (transfer_slip, purchase_receipt, expense_receipt, or other), amount_total, document_date_local (YYYY-MM-DD or null), merchant, reference_number, bank, confidence (0..1).",
        input: [{ role: "user", content: [{ type: "input_image", image_url: dataUrl }] }],
        max_output_tokens: 400,
        reasoning: { effort: "none" },
        text: { format: { type: "json_schema", name: "snk_slip", strict: false, schema: { type: "object" } } },
      }),
    });
    if (!response.ok) throw new Error(`SNK slip extraction failed ${response.status}`);
    const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    let raw = payload.output_text ?? "";
    if (!raw) for (const item of payload.output ?? []) for (const part of item.content ?? []) if (part.type === "output_text" && part.text) raw += part.text;
    const parsed = JSON.parse(raw.replace(/^```(?:json)?|```$/g, "").trim()) as Record<string, unknown>;
    const amount = typeof parsed.amount_total === "number" && Number.isFinite(parsed.amount_total) ? parsed.amount_total : null;
    const date = typeof parsed.document_date_local === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.document_date_local) ? parsed.document_date_local : null;
    const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0;
    return {
      document_type: typeof parsed.document_type === "string" ? parsed.document_type : "other",
      amount_total: amount,
      document_date_local: date,
      merchant: typeof parsed.merchant === "string" ? parsed.merchant.slice(0, 180) : null,
      reference_number: typeof parsed.reference_number === "string" ? parsed.reference_number.slice(0, 120) : null,
      bank: typeof parsed.bank === "string" ? parsed.bank.slice(0, 120) : null,
      confidence,
    };
  } finally {
    clearTimeout(timer);
  }
}
