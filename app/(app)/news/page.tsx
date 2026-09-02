"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, useActiveTab } from "@/components/tabs";
import { Card, EmptyState, SectionHead, Btn } from "@/components/ui";
import { NewsCard } from "@/components/news-card";
import { NewsArticleSheet } from "@/components/news-article-detail";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import { formatRelativeTime } from "@/lib/format";
import type { NewsArticle, NewsCategory } from "@/lib/news/types";

type BriefPoint = { headline: string; what_happened: string; why_it_matters: string; source: string; article_url: string };
type SavedItem = { id: string; headline: string; source: string; source_url: string; article_url: string; summary: string; category: string; published_at: string | null; saved_at: string; dedupe_key: string | null };

const CATEGORY_KEYS: NewsCategory[] = ["world", "thailand", "business", "markets", "tech"];

function NewsContent() {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const TABS = [
    { key: "brief", label: t("news.tabBrief") },
    { key: "world", label: t("news.tabWorld") },
    { key: "thailand", label: t("news.tabThailand") },
    { key: "business", label: t("news.tabBusiness") },
    { key: "markets", label: t("news.tabMarkets") },
    { key: "tech", label: t("news.tabTech") },
    { key: "saved", label: t("news.tabSaved") },
  ];
  const active = useActiveTab(TABS);

  const [articles, setArticles] = useState<NewsArticle[] | null>(null);
  const [partial, setPartial] = useState(false);
  const [briefPoints, setBriefPoints] = useState<BriefPoint[] | null>(null);
  const [savedItems, setSavedItems] = useState<SavedItem[] | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<NewsArticle | null>(null);

  const loadSaved = useCallback(async () => {
    const res = await fetch("/api/news/saved");
    if (!res.ok) return;
    const data = await res.json();
    const items: SavedItem[] = data.items || [];
    setSavedItems(items);
    setSavedKeys(new Set(items.map((i) => i.dedupe_key || i.article_url)));
  }, []);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const loadCategory = useCallback(
    async (category: NewsCategory) => {
      setLoading(true);
      setArticles(null);
      try {
        const res = await fetch(`/api/news?category=${category}&lang=${locale}`);
        const data = await res.json();
        setArticles(data.articles || []);
        setPartial(Boolean(data.partial));
        setLastUpdated(data.fetched_at || null);

        const articleParam = searchParams.get("article");
        if (articleParam) {
          const match = (data.articles || []).find((a: NewsArticle) => a.id === articleParam);
          if (match) setSelected(match);
        }
      } catch {
        setArticles([]);
        setPartial(true);
      } finally {
        setLoading(false);
      }
    },
    [locale, searchParams]
  );

  const loadBrief = useCallback(async () => {
    setLoading(true);
    setBriefPoints(null);
    try {
      const res = await fetch(`/api/news/brief?lang=${locale}`);
      const data = await res.json();
      setBriefPoints(data.points || []);
      setLastUpdated(data.fetched_at || null);
    } catch {
      setBriefPoints([]);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    if (active === "brief") loadBrief();
    else if (active === "saved") loadSaved();
    else if (CATEGORY_KEYS.includes(active as NewsCategory)) loadCategory(active as NewsCategory);
  }, [active, loadBrief, loadCategory, loadSaved]);

  async function toggleSave(article: NewsArticle) {
    const key = article.dedupe_key;
    if (savedKeys.has(key)) {
      await fetch(`/api/news/saved?dedupe_key=${encodeURIComponent(key)}`, { method: "DELETE" });
    } else {
      await fetch("/api/news/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: article.headline,
          source: article.source,
          source_url: article.source_url,
          article_url: article.article_url,
          summary: article.summary,
          category: article.category,
          published_at: article.published_at,
          dedupe_key: article.dedupe_key,
        }),
      });
    }
    loadSaved();
  }

  async function unsaveSavedItem(item: SavedItem) {
    const supabase = createClient();
    await supabase.from("saved_news").delete().eq("id", item.id);
    loadSaved();
  }

  function refresh() {
    if (active === "brief") loadBrief();
    else if (active === "saved") loadSaved();
    else if (CATEGORY_KEYS.includes(active as NewsCategory)) loadCategory(active as NewsCategory);
  }

  return (
    <div>
      <Card className="bg-gradient-to-br from-panel to-panel2">
        <div className="text-[11px] uppercase tracking-[0.12em] text-gold">{t("news.title")}</div>
        <h1 className="my-2 text-2xl font-extrabold">{t("news.subtitle")}</h1>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{lastUpdated ? t("news.lastUpdated", { time: formatRelativeTime(lastUpdated, locale) }) : ""}</span>
          <button onClick={refresh} className="rounded-full border border-line px-3 py-1 font-semibold text-ink">
            {loading ? t("news.refreshing") : t("news.refresh")}
          </button>
        </div>
      </Card>

      <Tabs tabs={TABS} />

      {partial && active !== "brief" && active !== "saved" && (
        <div className="mb-3 rounded-lg bg-amber/10 px-3 py-2 text-xs text-amber">{t("news.partialError")}</div>
      )}

      {active === "brief" && (
        <div>
          <SectionHead title={t("news.briefTitle")} subtitle={t("news.briefSubtitle")} />
          <Card>
            {briefPoints === null && <EmptyState label={t("common.loading")} />}
            {briefPoints !== null && briefPoints.length === 0 && <EmptyState label={t("news.briefEmpty")} />}
            {briefPoints?.map((p, i) => (
              <div key={i} className="border-b border-line py-3 last:border-0">
                <b className="block text-sm">{p.headline}</b>
                <p className="mt-1 text-xs text-muted">
                  <span className="font-semibold text-ink">{t("news.whatHappened")}:</span> {p.what_happened}
                </p>
                <p className="mt-1 text-xs text-muted">
                  <span className="font-semibold text-ink">{t("news.whyItMatters")}:</span> {p.why_it_matters}
                </p>
                <a href={p.article_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-gold">
                  {p.source} · {t("news.openOriginal")}
                </a>
              </div>
            ))}
          </Card>
        </div>
      )}

      {CATEGORY_KEYS.includes(active as NewsCategory) && (
        <Card>
          {articles === null && <EmptyState label={t("common.loading")} />}
          {articles !== null && articles.length === 0 && <EmptyState label={t("news.empty")} />}
          {articles?.map((a) => (
            <NewsCard key={a.id} article={a} saved={savedKeys.has(a.dedupe_key)} onOpen={() => setSelected(a)} onToggleSave={() => toggleSave(a)} />
          ))}
        </Card>
      )}

      {active === "saved" && (
        <Card>
          {savedItems === null && <EmptyState label={t("common.loading")} />}
          {savedItems !== null && savedItems.length === 0 && <EmptyState label={t("news.savedEmpty")} />}
          {savedItems?.map((item) => (
            <div key={item.id} className="border-b border-line py-3 last:border-0">
              <a href={item.article_url} target="_blank" rel="noreferrer" className="block">
                <b className="block text-sm">{item.headline}</b>
                <small className="text-muted">{item.source}</small>
              </a>
              <Btn onClick={() => unsaveSavedItem(item)} className="mt-2">
                {t("news.unsave")}
              </Btn>
            </div>
          ))}
        </Card>
      )}

      <NewsArticleSheet
        article={selected}
        saved={selected ? savedKeys.has(selected.dedupe_key) : false}
        onToggleSave={() => selected && toggleSave(selected)}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

export default function NewsPage() {
  return (
    <Suspense>
      <NewsContent />
    </Suspense>
  );
}
