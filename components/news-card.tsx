"use client";

import type { NewsArticle } from "@/lib/news/types";
import { formatRelativeTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";

const IMPORTANCE_STYLE: Record<NewsArticle["importance"], string> = {
  critical: "bg-red/15 text-red",
  important: "bg-amber/15 text-amber",
  worth_knowing: "bg-panel2 text-muted",
};

export function NewsCard({
  article,
  saved,
  onOpen,
  onToggleSave,
}: {
  article: NewsArticle;
  saved: boolean;
  onOpen: () => void;
  onToggleSave: () => void;
}) {
  const { t, locale } = useI18n();
  const importanceLabel =
    article.importance === "critical" ? t("news.critical") : article.importance === "important" ? t("news.important") : t("news.worthKnowing");

  return (
    <div className="border-b border-line py-3 last:border-0">
      <button className="block w-full text-left" onClick={onOpen}>
        <div className="mb-1 flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${IMPORTANCE_STYLE[article.importance]}`}>
            {importanceLabel}
          </span>
          {article.also_reported_by && article.also_reported_by.length > 0 && (
            <span className="text-[10px] text-muted">{t("news.alsoReportedBy", { sources: article.also_reported_by.join(", ") })}</span>
          )}
        </div>
        <b className="block text-sm leading-snug">{article.headline}</b>
        <p className="mt-1 line-clamp-2 text-xs text-muted">{article.summary}</p>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
          <span>{article.source}</span>
          <span>·</span>
          <span>{formatRelativeTime(article.published_at, locale)}</span>
        </div>
      </button>
      <button
        onClick={onToggleSave}
        className={`mt-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
          saved ? "border-gold bg-gold/10 text-gold" : "border-line text-muted"
        }`}
      >
        {saved ? `✓ ${t("news.saved")}` : `☆ ${t("news.save")}`}
      </button>
    </div>
  );
}
