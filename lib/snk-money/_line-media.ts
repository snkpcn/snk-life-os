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
  // Keep extraction inside SNK and fail over across supported Gemini models.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("SNK slip extraction is not configured");

  const models = [...new Set([
    process.env.SNK_SLIP_MODEL?.trim(),
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
  ].filter((model): model is string => Boolean(model)))];
  const deadline = Date.now() + 18_000;
  const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);
  let lastError: Error = new Error("SNK slip extraction failed");
  const requestBody = JSON.stringify({
    contents: [{ role: "user", parts: [
      { text: "Read only visible facts from this Thai payment slip or receipt. Do not infer the expense purpose, source account, or missing values. Convert Buddhist year to Gregorian. Return JSON with document_type (transfer_slip, purchase_receipt, expense_receipt, or other), amount_total as number or null, document_date_local (YYYY-MM-DD or null), merchant (receiver name or null), reference_number, bank (printed bank name or null), confidence (0..1)." },
      { inline_data: { mime_type: mimeType, data: bytes.toString("base64") } },
    ] }],
    generationConfig: { responseMimeType: "application/json", maxOutputTokens: 700, temperature: 0 },
  });

  for (const model of models) {
    for (let attempt = 0; attempt < 2 && Date.now() < deadline; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(7_000, deadline - Date.now()));
      let response: Response;
      try {
        response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          signal: controller.signal,
          body: requestBody,
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Gemini request failed");
        if (attempt === 0 && Date.now() + 250 < deadline) await new Promise(resolve => setTimeout(resolve, 250));
        continue;
      } finally {
        clearTimeout(timer);
      }

      if (response.status === 404) {
        lastError = new Error("SNK slip model unavailable (404)");
        break;
      }
      if (retryableStatuses.has(response.status)) {
        lastError = new Error("SNK slip extraction failed (" + response.status + ")");
        if (attempt === 0 && Date.now() + 250 < deadline) await new Promise(resolve => setTimeout(resolve, 250));
        continue;
      }
      if (!response.ok) throw new Error("SNK slip extraction failed (" + response.status + ")");

      try {
        const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const raw = payload.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join("") ?? "";
        const parsed = JSON.parse(raw.trim()) as Record<string, unknown>;
        const rawAmount = parsed.amount_total;
        const amount = typeof rawAmount === "number" && Number.isFinite(rawAmount) ? rawAmount
          : typeof rawAmount === "string" && /^\d+(?:\.\d{1,2})?$/.test(rawAmount.trim()) ? Number(rawAmount) : null;
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
      } catch {
        lastError = new Error("SNK slip extraction returned invalid JSON");
        break;
      }
    }
  }

  throw lastError;
}
