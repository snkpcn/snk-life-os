"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { useI18n } from "@/lib/i18n/context";
import type { NewsArticle } from "@/lib/news/types";

export function DailyNewsBrief() {
  const { t, locale } = useI18n();
  const [world, setWorld] = useState<NewsArticle[] | null>(null);
  const [thailand, setThailand] = useState<NewsArticle[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [w, th] = await Promise.all([
          fetch(`/api/news?category=world&limit=3&lang=${locale}`).then((r) => (r.ok ? r.json() : { articles: [] })),
          fetch(`/api/news?category=thailand&limit=3&lang=${locale}`).then((r) => (r.ok ? r.json() : { articles: [] })),
        ]);
        if (cancelled) return;
        setWorld(w.articles || []);
        setThailand(th.articles || []);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  if (failed) {
    return (
      <Card>
        <p className="text-sm text-muted">{t("today.newsUnavailable")}</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <NewsGroup title={t("today.world")} articles={world} />
      <NewsGroup title={t("today.thailand")} articles={thailand} />
    </Card>
  );
}

function NewsGroup({ title, articles }: { title: string; articles: NewsArticle[] | null }) {
  const { t } = useI18n();
  return (
    <div>
      <b className="mb-1 block text-xs uppercase tracking-wide text-gold">{title}</b>
      {articles === null && <p className="text-sm text-muted">{t("common.loading")}</p>}
      {articles !== null && articles.length === 0 && <p className="text-sm text-muted">{t("news.empty")}</p>}
      {articles?.map((a) => (
        <Link
          key={a.id}
          href={`/news?tab=${a.category}&article=${encodeURIComponent(a.id)}`}
          className="block border-b border-line py-2 text-sm last:border-0"
        >
          {a.headline}
        </Link>
      ))}
    </div>
  );
}
