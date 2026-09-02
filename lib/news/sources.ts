import type { NewsCategory } from "./types";

export type NewsSource = {
  id: string;
  name: string;
  feedUrl: string;
  homepageUrl: string;
  category: NewsCategory;
  region: "world" | "thailand";
  language: string;
  /** Preferred sources are tried first and, if they succeed, given priority in dedupe grouping. */
  preferred?: boolean;
};

// NOTE ON RELIABILITY: this environment's own sandbox cannot make outbound requests to
// arbitrary news sites to spot-check these feed URLs live (only the deployed Vercel
// functions can, at runtime, since Vercel has normal internet egress). Every fetch in
// lib/news/rss.ts validates that a response is actually well-formed RSS/Atom with items
// before trusting it, and a provider that 404s, times out, or returns something else is
// silently excluded rather than breaking the category or fabricating articles — so a
// stale URL here degrades gracefully instead of lying about where a story came from.
export const NEWS_SOURCES: NewsSource[] = [
  // World
  { id: "bbc-world", name: "BBC News", feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml", homepageUrl: "https://www.bbc.com/news/world", category: "world", region: "world", language: "en", preferred: true },
  { id: "aljazeera-world", name: "Al Jazeera", feedUrl: "https://www.aljazeera.com/xml/rss/all.xml", homepageUrl: "https://www.aljazeera.com", category: "world", region: "world", language: "en" },

  // Thailand — Thai Rath is the owner's explicitly preferred source; Bangkok Post and The
  // Nation are the permitted fallbacks so Thailand coverage never depends on one provider.
  { id: "thairath", name: "ไทยรัฐ (Thai Rath)", feedUrl: "https://www.thairath.co.th/rss/news", homepageUrl: "https://www.thairath.co.th", category: "thailand", region: "thailand", language: "th", preferred: true },
  { id: "bangkokpost", name: "Bangkok Post", feedUrl: "https://www.bangkokpost.com/rss/data/topstories.xml", homepageUrl: "https://www.bangkokpost.com", category: "thailand", region: "thailand", language: "en" },
  { id: "nationthailand", name: "The Nation Thailand", feedUrl: "https://www.nationthailand.com/rss", homepageUrl: "https://www.nationthailand.com", category: "thailand", region: "thailand", language: "en" },

  // Business
  { id: "bbc-business", name: "BBC News", feedUrl: "https://feeds.bbci.co.uk/news/business/rss.xml", homepageUrl: "https://www.bbc.com/news/business", category: "business", region: "world", language: "en", preferred: true },
  { id: "bangkokpost-business", name: "Bangkok Post", feedUrl: "https://www.bangkokpost.com/rss/data/business.xml", homepageUrl: "https://www.bangkokpost.com/business", category: "business", region: "thailand", language: "en" },

  // Markets
  { id: "yahoo-finance", name: "Yahoo Finance", feedUrl: "https://finance.yahoo.com/news/rssindex", homepageUrl: "https://finance.yahoo.com", category: "markets", region: "world", language: "en", preferred: true },

  // Tech / AI
  { id: "bbc-tech", name: "BBC News", feedUrl: "https://feeds.bbci.co.uk/news/technology/rss.xml", homepageUrl: "https://www.bbc.com/news/technology", category: "tech", region: "world", language: "en", preferred: true },
  { id: "techcrunch", name: "TechCrunch", feedUrl: "https://techcrunch.com/feed/", homepageUrl: "https://techcrunch.com", category: "tech", region: "world", language: "en" },
];

export function sourcesForCategory(category: NewsCategory): NewsSource[] {
  return NEWS_SOURCES.filter((s) => s.category === category);
}
