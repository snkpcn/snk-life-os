import type { NewsArticle } from "./types";

const STOPWORDS = new Set([
  "the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "is", "are", "with", "as", "at", "by", "from",
  "after", "over", "amid", "into", "its", "it", "their", "his", "her", "says", "said",
]);

function normalizedWords(headline: string): Set<string> {
  return new Set(
    headline
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const SIMILARITY_THRESHOLD = 0.55;

/** Groups near-duplicate stories about the same event, keeping the highest-priority source as primary. */
export function deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
  const withWords = articles.map((a) => ({ article: a, words: normalizedWords(a.headline) }));
  const used = new Set<number>();
  const result: NewsArticle[] = [];

  for (let i = 0; i < withWords.length; i++) {
    if (used.has(i)) continue;
    const group = [withWords[i]];
    used.add(i);
    for (let j = i + 1; j < withWords.length; j++) {
      if (used.has(j)) continue;
      if (jaccard(withWords[i].words, withWords[j].words) >= SIMILARITY_THRESHOLD) {
        group.push(withWords[j]);
        used.add(j);
      }
    }
    group.sort((a, b) => {
      if (a.article.published_at && b.article.published_at) {
        return new Date(b.article.published_at).getTime() - new Date(a.article.published_at).getTime();
      }
      return 0;
    });
    const primary = group[0].article;
    const alsoReportedBy = group.slice(1).map((g) => g.article.source);
    result.push(alsoReportedBy.length > 0 ? { ...primary, also_reported_by: alsoReportedBy } : primary);
  }

  return result;
}
