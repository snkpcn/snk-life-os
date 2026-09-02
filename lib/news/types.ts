export type NewsCategory = "world" | "thailand" | "business" | "markets" | "tech";
export type NewsImportance = "critical" | "important" | "worth_knowing";

export type NewsArticle = {
  id: string;
  headline: string;
  source: string;
  source_url: string;
  article_url: string;
  published_at: string | null;
  fetched_at: string;
  category: NewsCategory;
  region: "world" | "thailand";
  language: string;
  importance: NewsImportance;
  summary: string;
  image_url: string | null;
  provider: string;
  dedupe_key: string;
  also_reported_by?: string[];
};

export type NewsFetchResult = {
  articles: NewsArticle[];
  /** Provider ids that failed this request — the category degrades gracefully rather than erroring out. */
  failedProviders: string[];
};
