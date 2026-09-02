"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, SectionHead, Btn } from "@/components/ui";
import { ResourceForm } from "@/components/resource-form";
import { RESOURCES } from "@/lib/resources";
import { CryptoChart } from "@/components/crypto/crypto-chart";
import { StockHeader } from "@/components/stocks/stock-header";
import { StockTable } from "@/components/stocks/stock-table";
import { NewsCard } from "@/components/news-card";
import { NewsArticleSheet } from "@/components/news-article-detail";
import { useI18n } from "@/lib/i18n/context";
import { SET50 } from "@/lib/stocks/set50";
import { SP500 } from "@/lib/stocks/sp500";
import type { StockChartPoint, StockChartRange, StockMarket, StockQuote } from "@/lib/stocks/types";
import type { NewsArticle } from "@/lib/news/types";

const RANGES: StockChartRange[] = ["1D", "5D", "1M", "3M", "6M", "1Y", "5Y"];
type ActionKind = "watch" | "holding" | "alert" | "note" | null;

const NEWS_CATEGORIES: Record<StockMarket, string[]> = {
  TH: ["thailand", "business", "markets"],
  US: ["markets", "business", "tech"],
};

const DEFAULT_SYMBOL: Record<StockMarket, string> = { TH: SET50[0].symbol, US: SP500[0].symbol };

export function StockMarketDashboard() {
  const { t, locale } = useI18n();
  const [market, setMarket] = useState<StockMarket>("TH");
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);

  const constituents = market === "TH" ? SET50 : SP500;

  // Selection state is deliberately separate from any fetched data — tapping a row must
  // change this immediately, regardless of whether that stock's quote/chart ever loads.
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_SYMBOL.TH);
  // Remembers the last symbol picked in each market, so switching markets and back restores it.
  const [lastSelectedByMarket, setLastSelectedByMarket] = useState<Record<StockMarket, string>>({ ...DEFAULT_SYMBOL });

  const selectedMeta = useMemo(() => constituents.find((c) => c.symbol === selectedSymbol) ?? constituents[0], [constituents, selectedSymbol]);

  const [selectedQuote, setSelectedQuote] = useState<StockQuote | null>(null);
  const [chart, setChart] = useState<StockChartPoint[]>([]);
  const [range, setRange] = useState<StockChartRange>("1M");
  const [chartLoading, setChartLoading] = useState(false);
  const [action, setAction] = useState<ActionKind>(null);

  const [marketNews, setMarketNews] = useState<NewsArticle[]>([]);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [askInput, setAskInput] = useState("");
  const [askReply, setAskReply] = useState<string | null>(null);
  const [askBusy, setAskBusy] = useState(false);

  function selectSymbol(symbol: string) {
    setSelectedSymbol(symbol);
    setLastSelectedByMarket((prev) => ({ ...prev, [market]: symbol }));
  }

  function switchMarket(next: StockMarket) {
    if (next === market) return;
    setMarket(next);
    setSelectedSymbol(lastSelectedByMarket[next]);
    setAskReply(null);
  }

  useEffect(() => {
    let cancelled = false;
    setQuotesLoading(true);
    fetch(`/api/stocks/quotes?market=${market}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setQuotes(data.quotes || []);
      })
      .catch(() => {
        if (!cancelled) setQuotes([]);
      })
      .finally(() => {
        if (!cancelled) setQuotesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [market]);

  useEffect(() => {
    let cancelled = false;
    // Clear any previous stock's quote/chart immediately — never let ADVANC's header keep
    // showing AAPL's stale data just because AAPL's fetch happened to resolve first/only.
    setSelectedQuote(null);
    setChart([]);
    setChartLoading(true);
    fetch(`/api/stocks/chart?symbol=${encodeURIComponent(selectedSymbol)}&market=${market}&range=${range}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSelectedQuote(data.quote || null);
        setChart(data.chart || []);
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedQuote(null);
          setChart([]);
        }
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSymbol, market, range]);

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

  const loadSaved = useMemo(
    () => async () => {
      try {
        const res = await fetch("/api/news/saved");
        if (!res.ok) return;
        const data = await res.json();
        setSavedKeys(new Set((data.items || []).map((i: { dedupe_key: string | null; article_url: string }) => i.dedupe_key || i.article_url)));
      } catch {
        // saved-state is a convenience layer only — never blocks the news list itself
      }
    },
    []
  );

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

  const relatedNews = useMemo(() => {
    const keywords = [selectedMeta.symbol.toLowerCase(), selectedMeta.name.toLowerCase()];
    return marketNews.filter((a) => keywords.some((k) => a.headline.toLowerCase().includes(k) || a.summary.toLowerCase().includes(k))).slice(0, 4);
  }, [marketNews, selectedMeta]);

  async function ask(question: string) {
    if (!question.trim() || askBusy) return;
    setAskBusy(true);
    setAskReply(null);
    try {
      const res = await fetch("/api/stark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          history: [],
          locale,
          stock: {
            symbol: selectedMeta.symbol,
            name: selectedMeta.name,
            market,
            price: selectedQuote?.price ?? null,
            changePercent: selectedQuote?.changePercent ?? null,
            currency: selectedQuote?.currency || (market === "TH" ? "THB" : "USD"),
          },
        }),
      });
      const data = await res.json();
      setAskReply(data.reply || data.error || "…");
    } catch {
      setAskReply(t("starkPage.error"));
    } finally {
      setAskBusy(false);
      setAskInput("");
    }
  }

  const exchangeLabel = market === "TH" ? "SET" : selectedQuote?.exchange || "US";
  const currency = selectedQuote?.currency || (market === "TH" ? "THB" : "USD");

  // Actions target selectedMeta (symbol + name), which is always available synchronously —
  // Watch/Holding/Alert/Note must work even when the live quote hasn't loaded or failed.
  if (action) {
    const resource =
      action === "watch" ? RESOURCES.watchlist_items : action === "holding" ? RESOURCES.holdings : action === "alert" ? RESOURCES.price_alerts : RESOURCES.notes_table;
    const prefill =
      action === "watch"
        ? { ticker: selectedMeta.symbol, name: selectedMeta.name, market: exchangeLabel }
        : action === "holding"
          ? { ticker: selectedMeta.symbol, name: selectedMeta.name, market: exchangeLabel, asset_class: "Stock", currency }
          : action === "alert"
            ? { symbol: selectedMeta.symbol, market: exchangeLabel, currency }
            : { title: `${selectedMeta.name} (${selectedMeta.symbol})` };
    return (
      <Card className="mt-4">
        <ResourceForm resource={resource} prefill={prefill} onCancel={() => setAction(null)} onSaved={() => setAction(null)} />
      </Card>
    );
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

      <Card>
        <StockHeader symbol={selectedMeta.symbol} name={selectedMeta.name} quote={selectedQuote} loading={chartLoading} />

        <div className="mt-3 flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-full border px-3 py-1 text-xs font-bold ${range === r ? "border-gold bg-gold/10 text-gold" : "border-line text-muted"}`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="mt-2 rounded-xl border border-line bg-bg p-2">
          <CryptoChart points={chart} height={240} />
        </div>
        {!chartLoading && chart.length === 0 && <p className="mt-2 text-center text-xs text-muted">{t("stocksPage.chartUnavailable")}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          <Btn variant="gold" onClick={() => setAction("watch")}>
            {t("stocksPage.watch")}
          </Btn>
          <Btn onClick={() => setAction("holding")}>{t("stocksPage.addHolding")}</Btn>
          <Btn onClick={() => setAction("alert")}>{t("stocksPage.priceAlert")}</Btn>
          <Btn onClick={() => setAction("note")}>{t("stocksPage.note")}</Btn>
        </div>
      </Card>

      <SectionHead title={market === "TH" ? t("stocksPage.set50Title") : t("stocksPage.sp500Title")} subtitle={t("stocksPage.tapToOpen")} />
      <Card>
        <StockTable constituents={constituents} quotes={quotes} selectedSymbol={selectedSymbol} onSelect={selectSymbol} loading={quotesLoading} />
      </Card>

      <SectionHead title={t("stocksPage.marketNews")} />
      <Card>
        {marketNews.length === 0 && <p className="text-sm text-muted">{t("stocksPage.noNews")}</p>}
        {marketNews.map((n) => (
          <NewsCard key={n.id} article={n} saved={savedKeys.has(n.dedupe_key)} onOpen={() => setSelectedArticle(n)} onToggleSave={() => toggleSave(n)} />
        ))}
      </Card>

      {relatedNews.length > 0 && (
        <>
          <SectionHead title={t("stocksPage.relatedNews", { symbol: selectedMeta.symbol })} />
          <Card>
            {relatedNews.map((n) => (
              <NewsCard key={n.id} article={n} saved={savedKeys.has(n.dedupe_key)} onOpen={() => setSelectedArticle(n)} onToggleSave={() => toggleSave(n)} />
            ))}
          </Card>
        </>
      )}

      <NewsArticleSheet
        article={selectedArticle}
        saved={selectedArticle ? savedKeys.has(selectedArticle.dedupe_key) : false}
        onToggleSave={() => selectedArticle && toggleSave(selectedArticle)}
        onClose={() => setSelectedArticle(null)}
      />

      <SectionHead title={t("stocksPage.askStark")} />
      <Card>
        {askBusy && <p className="text-sm text-muted">{t("starkPage.thinking")}</p>}
        {askReply && <p className="whitespace-pre-wrap text-sm leading-relaxed">{askReply}</p>}
        <div className="mt-2 flex gap-2">
          <input
            value={askInput}
            onChange={(e) => setAskInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(askInput)}
            placeholder={locale === "th" ? t("stocksPage.starkPlaceholderTh") : t("stocksPage.starkPlaceholderEn")}
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-panel px-3 text-sm text-ink outline-none"
          />
          <Btn variant="gold" onClick={() => ask(askInput)} disabled={askBusy}>
            {t("stocksPage.askStark")}
          </Btn>
        </div>
      </Card>
    </div>
  );
}
