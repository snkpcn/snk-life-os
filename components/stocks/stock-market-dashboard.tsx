"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, SectionHead } from "@/components/ui";
import { StockTable } from "@/components/stocks/stock-table";
import { StockDetailSheet } from "@/components/stocks/stock-detail-sheet";
import { NewsCard } from "@/components/news-card";
import { NewsArticleSheet } from "@/components/news-article-detail";
import { useI18n } from "@/lib/i18n/context";
import { SET50 } from "@/lib/stocks/set50";
import { SP500 } from "@/lib/stocks/sp500";
import type { StockMarket, StockQuote } from "@/lib/stocks/types";
import type { NewsArticle } from "@/lib/news/types";

const DEFAULT_SYMBOL: Record<StockMarket, string> = { TH: SET50[0].symbol, US: SP500[0].symbol };

const NEWS_CATEGORIES: Record<StockMarket, string[]> = {
  TH: ["thailand", "business", "markets"],
  US: ["markets", "business", "tech"],
};

function quoteKey(market: StockMarket, symbol: string) {
  return `${market}:${symbol}`;
}

export function StockMarketDashboard() {
  const { t, locale } = useI18n();
  const [market, setMarket] = useState<StockMarket>("TH");
  const constituents = market === "TH" ? SET50 : SP500;

  // Selection state is deliberately separate from any fetched data — tapping a row must change
  // this (and open the detail sheet) immediately, regardless of whether a quote ever loads.
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_SYMBOL.TH);
  const [detailOpen, setDetailOpen] = useState(false);
  const [lastSelectedByMarket, setLastSelectedByMarket] = useState<Record<StockMarket, string>>({ ...DEFAULT_SYMBOL });

  const selectedMeta = useMemo(() => constituents.find((c) => c.symbol === selectedSymbol) ?? constituents[0], [constituents, selectedSymbol]);

  // Quote cache keyed by "market:symbol" — only ever grows with symbols actually needed on
  // screen (visible table rows), never the whole constituent list up front.
  const [quoteCache, setQuoteCache] = useState<Record<string, StockQuote>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesUnavailable, setQuotesUnavailable] = useState(false);
  const pendingRef = useRef<Set<string>>(new Set());

  const [marketNews, setMarketNews] = useState<NewsArticle[]>([]);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  function selectSymbol(symbol: string) {
    setSelectedSymbol(symbol);
    setLastSelectedByMarket((prev) => ({ ...prev, [market]: symbol }));
    setDetailOpen(true);
  }

  function switchMarket(next: StockMarket) {
    if (next === market) return;
    setMarket(next);
    setSelectedSymbol(lastSelectedByMarket[next]);
  }

  const handleVisibleSymbolsChange = useCallback(
    (symbols: string[]) => {
      const need = symbols.filter((s) => !(quoteKey(market, s) in quoteCache) && !pendingRef.current.has(quoteKey(market, s)));
      if (need.length === 0) return;
      need.forEach((s) => pendingRef.current.add(quoteKey(market, s)));
      setQuotesLoading(true);
      fetch(`/api/stocks/quotes?market=${market}&symbols=${encodeURIComponent(need.join(","))}`)
        .then((r) => r.json())
        .then((data) => {
          const fetched: StockQuote[] = data.quotes || [];
          setQuoteCache((prev) => {
            const next = { ...prev };
            for (const q of fetched) next[quoteKey(market, q.symbol)] = q;
            return next;
          });
          setQuotesUnavailable(Boolean(data.unavailable));
        })
        .catch(() => setQuotesUnavailable(true))
        .finally(() => {
          need.forEach((s) => pendingRef.current.delete(quoteKey(market, s)));
          setQuotesLoading(false);
        });
    },
    [market, quoteCache]
  );

  const visibleQuotes = useMemo(() => {
    const out: StockQuote[] = [];
    for (const c of constituents) {
      const q = quoteCache[quoteKey(market, c.symbol)];
      if (q) out.push(q);
    }
    return out;
  }, [constituents, market, quoteCache]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cats = NEWS_CATEGORIES[market];
        const results = await Promise.all(cats.map((c) => fetch(`/api/news?category=${c}&lang=${locale}&limit=6`).then((r) => (r.ok ? r.json() : { articles: [] }))));
        if (cancelled) return;
        const merged: NewsArticle[] = [];
        const seen = new Set<string>();
        for (const res of results) {
          for (const a of res.articles || []) {
            if (!seen.has(a.dedupe_key || a.id)) {
              seen.add(a.dedupe_key || a.id);
              merged.push(a);
            }
          }
        }
        setMarketNews(merged.slice(0, 8));
      } catch {
        if (!cancelled) setMarketNews([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [market, locale]);

  const loadSaved = useCallback(async () => {
    try {
      const res = await fetch("/api/news/saved");
      if (!res.ok) return;
      const data = await res.json();
      setSavedKeys(new Set((data.items || []).map((i: { dedupe_key: string | null; article_url: string }) => i.dedupe_key || i.article_url)));
    } catch {
      // saved-state is a convenience layer only — never blocks the news list itself
    }
  }, []);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

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

  return (
    <div>
      <div className="my-4 flex gap-2">
        {(["TH", "US"] as StockMarket[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMarket(m)}
            className={`flex-1 rounded-xl border px-4 py-2 text-sm font-bold ${market === m ? "border-gold bg-gold/10 text-gold" : "border-line text-muted"}`}
          >
            {m === "TH" ? t("stocksPage.marketThailand") : t("stocksPage.marketUS")}
          </button>
        ))}
      </div>

      <SectionHead title={market === "TH" ? t("stocksPage.set50Title") : t("stocksPage.sp500Title")} subtitle={t("stocksPage.tapToOpen")} />
      <Card>
        <StockTable
          constituents={constituents}
          quotes={visibleQuotes}
          selectedSymbol={selectedSymbol}
          onSelect={selectSymbol}
          loading={quotesLoading}
          quotesUnavailable={quotesUnavailable}
          onVisibleSymbolsChange={handleVisibleSymbolsChange}
        />
      </Card>

      <SectionHead title={t("stocksPage.marketNews")} />
      <Card>
        {marketNews.length === 0 && <p className="text-sm text-muted">{t("stocksPage.noNews")}</p>}
        {marketNews.map((n) => (
          <NewsCard key={n.id} article={n} saved={savedKeys.has(n.dedupe_key)} onOpen={() => setSelectedArticle(n)} onToggleSave={() => toggleSave(n)} />
        ))}
      </Card>

      <StockDetailSheet
        symbol={detailOpen ? selectedSymbol : null}
        market={market}
        meta={selectedMeta}
        marketNews={marketNews}
        savedKeys={savedKeys}
        onToggleSave={toggleSave}
        onOpenArticle={(article) => setSelectedArticle(article)}
        onClose={() => setDetailOpen(false)}
      />

      <NewsArticleSheet
        article={selectedArticle}
        saved={selectedArticle ? savedKeys.has(selectedArticle.dedupe_key) : false}
        onToggleSave={() => selectedArticle && toggleSave(selectedArticle)}
        onClose={() => setSelectedArticle(null)}
      />
    </div>
  );
}
