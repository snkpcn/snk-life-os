import type { NewsArticle, NewsCategory, NewsFetchResult } from "./types";
import { sourcesForCategory } from "./sources";
import { fetchSource } from "./rss";
import { deduplicateArticles } from "./dedupe";

const IMPORTANCE_RANK: Record<NewsArticle["importance"], number> = {
  critical: 0,
  important: 1,
  worth_knowing: 2,
};

export async function fetchCategory(category: NewsCategory, opts: { excludeProviders?: string[] } = {}): Promise<NewsFetchResult> {
  const sources = sourcesForCategory(category).filter((s) => !opts.excludeProviders?.includes(s.id));
  const settled = await Promise.allSettled(sources.map((s) => fetchSource(s)));

  const articles: NewsArticle[] = [];
  const failedProviders: string[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value.length > 0) {
      articles.push(...result.value);
    } else if (result.status === "rejected" || (result.status === "fulfilled" && result.value.length === 0)) {
      failedProviders.push(sources[i].id);
    }
  });

  const deduped = deduplicateArticles(articles);
  deduped.sort((a, b) => {
    const importanceDiff = IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance];
    if (importanceDiff !== 0) return importanceDiff;
    const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
    const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
    return bTime - aTime;
  });

  return { articles: deduped, failedProviders };
}
