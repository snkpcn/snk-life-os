import { XMLParser } from "fast-xml-parser";
import { createHash } from "crypto";
import type { NewsArticle } from "./types";
import type { NewsSource } from "./sources";
import { classifyImportance } from "./importance";

const FETCH_TIMEOUT_MS = 8000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, max = 220): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function hashId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 24);
}

function extractImage(item: any): string | null {
  const media = item["media:content"] || item["media:thumbnail"];
  if (media) {
    const first = Array.isArray(media) ? media[0] : media;
    if (first?.["@_url"]) return first["@_url"];
  }
  const enclosure = item.enclosure;
  if (enclosure) {
    const first = Array.isArray(enclosure) ? enclosure[0] : enclosure;
    if (first?.["@_url"] && String(first?.["@_type"] || "").startsWith("image")) return first["@_url"];
  }
  return null;
}

function normalizeRssItem(item: any, source: NewsSource, now: string): NewsArticle | null {
  const headline = stripHtml(typeof item.title === "string" ? item.title : item.title?.["#text"]);
  const link = typeof item.link === "string" ? item.link : item.link?.["@_href"] || item.link?.["#text"];
  if (!headline || !link) return null;

  const rawSummary = item.description ?? item.summary ?? item["content:encoded"] ?? "";
  const summary = truncate(stripHtml(typeof rawSummary === "string" ? rawSummary : rawSummary?.["#text"]));
  const pubDateRaw = item.pubDate || item.published || item.updated || item["dc:date"];
  let publishedAt: string | null = null;
  if (pubDateRaw) {
    const parsed = new Date(pubDateRaw);
    if (!isNaN(parsed.getTime())) publishedAt = parsed.toISOString();
  }

  return {
    id: hashId(`${source.id}:${link}`),
    headline,
    source: source.name,
    source_url: source.homepageUrl,
    article_url: link,
    published_at: publishedAt,
    fetched_at: now,
    category: source.category,
    region: source.region,
    language: source.language,
    importance: classifyImportance(headline, summary),
    summary: summary || headline,
    image_url: extractImage(item),
    provider: source.id,
    dedupe_key: headline.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""),
  };
}

/** Fetches and normalizes one RSS/Atom source. Never throws — a broken/unreachable feed
 * simply returns an empty array, so one dead provider never breaks a whole category. */
export async function fetchSource(source: NewsSource): Promise<NewsArticle[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(source.feedUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SNKLifeOS/1.0; +https://snk-life-os-final-stable2.vercel.app)" },
      next: { revalidate: 900 },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();
    if (!contentType.includes("xml") && !text.trim().startsWith("<")) return [];

    const parsed = parser.parse(text);
    const now = new Date().toISOString();

    const rssItems = asArray(parsed?.rss?.channel?.item);
    if (rssItems.length > 0) {
      return rssItems.map((item) => normalizeRssItem(item, source, now)).filter((a): a is NewsArticle => a !== null);
    }

    const atomEntries = asArray(parsed?.feed?.entry);
    if (atomEntries.length > 0) {
      return atomEntries.map((item) => normalizeRssItem(item, source, now)).filter((a): a is NewsArticle => a !== null);
    }

    return [];
  } catch {
    return [];
  }
}
