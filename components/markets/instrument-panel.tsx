"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, SectionHead, Btn } from "@/components/ui";
import { ResourceForm } from "@/components/resource-form";
import { RESOURCES } from "@/lib/resources";
import { CryptoChart } from "@/components/crypto/crypto-chart";
import { NewsCard } from "@/components/news-card";
import { NewsArticleSheet } from "@/components/news-article-detail";
import { formatStockPrice, formatPercent, percentColorClass } from "@/lib/stocks/format";
import { formatRelativeTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";
import type { RawInstrumentQuote } from "@/lib/stocks/yahoo";
import type { StockChartPoint, StockChartRange } from "@/lib/stocks/types";
import type { NewsArticle } from "@/lib/news/types";

const RANGES: StockChartRange[] = ["1D", "5D", "1M", "3M", "6M", "1Y", "5Y"];
type ActionKind = "watch" | "holding" | "alert" | "note" | null;

/** Shared display for a single non-equity instrument (Gold, USD/THB) — same header/chart/
 * actions/news/Stark pattern as the stock detail sheet, but shown inline since there's no list
 * to pick from, just one instrument per tab. */
export function InstrumentPanel({
  apiPath,
  fallbackSymbol,
  fallbackName,
  resourceMarketLabel,
  newsKeywords,
  showThaiGoldIndicative,
}: {
  apiPath: string;
  fallbackSymbol: string;
  fallbackName: string;
  resourceMarketLabel: string;
  newsKeywords: string[];
  /** When true, reads `thaiGoldIndicative.pricePerBahtWeightTHB` from the API response (only
   * the Gold endpoint returns this field) and renders it as a clearly-labeled estimate. */
  showThaiGoldIndicative?: boolean;
}) {
  const { t, locale } = useI18n();
  const [quote, setQuote] = useState<RawInstrumentQuote | null>(null);
  const [chart, setChart] = useState<StockChartPoint[]>([]);
  const [thaiGoldIndicative, setThaiGoldIndicative] = useState<number | null>(null);
  const [range, setRange] = useState<StockChartRange>("1M");
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<ActionKind>(null);
  const [marketNews, setMarketNews] = useState<NewsArticle[]>([]);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [askInput, setAskInput] = useState("");
  const [askReply, setAskReply] = useState<string | null>(null);
  const [askBusy, setAskBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${apiPath}?range=${range}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setQuote(data.quote || null);
        setChart(data.chart || []);
        setThaiGoldIndicative(typeof data.thaiGoldIndicative?.pricePerBahtWeightTHB === "number" ? data.thaiGoldIndicative.pricePerBahtWeightTHB : null);
      })
      .catch(() => {
        if (!cancelled) {
          setQuote(null);
          setChart([]);
          setThaiGoldIndicative(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiPath, range]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [biz, markets] = await Promise.all([
          fetch(`/api/news?category=business&lang=${locale}&limit=6`).then((r) => (r.ok ? r.json() : { articles: [] })),
          fetch(`/api/news?category=markets&lang=${locale}&limit=6`).then((r) => (r.ok ? r.json() : { articles: [] })),
        ]);
        if (cancelled) return;
        const pool: NewsArticle[] = [...(biz.articles || []), ...(markets.articles || [])];
        const keywords = newsKeywords.map((k) => k.toLowerCase());
        const matched = pool.filter((a) => keywords.some((k) => a.headline.toLowerCase().includes(k) || a.summary.toLowerCase().includes(k)));
        setMarketNews(matched.slice(0, 6));
      } catch {
        if (!cancelled) setMarketNews([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const loadSaved = useMemo(
    () => async () => {
      try {
        const res = await fetch("/api/news/saved");
        if (!res.ok) return;
        const data = await res.json();
        setSavedKeys(new Set((data.items || []).map((i: { dedupe_key: string | null; article_url: string }) => i.dedupe_key || i.article_url)));
      } catch {
        // convenience layer only
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

  const displaySymbol = quote?.symbol || fallbackSymbol;
  const displayName = quote?.name || fallbackName;

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
          instrument: {
            symbol: displaySymbol,
            name: displayName,
            price: quote?.price ?? null,
            changePercent: quote?.changePercent ?? null,
            currency: quote?.currency || "USD",
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

  if (action) {
    const resource =
      action === "watch" ? RESOURCES.watchlist_items : action === "holding" ? RESOURCES.holdings : action === "alert" ? RESOURCES.price_alerts : RESOURCES.notes_table;
    const currency = quote?.currency || "USD";
    const prefill =
      action === "watch"
        ? { ticker: displaySymbol, name: displayName, market: resourceMarketLabel }
        : action === "holding"
          ? { ticker: displaySymbol, name: displayName, market: resourceMarketLabel, asset_class: resourceMarketLabel, currency }
          : action === "alert"
            ? { symbol: displaySymbol, market: resourceMarketLabel, currency }
            : { title: `${displayName} (${displaySymbol})` };
    return (
      <Card className="mt-4">
        <ResourceForm resource={resource} prefill={prefill} onCancel={() => setAction(null)} onSaved={() => setAction(null)} />
      </Card>
    );
  }

  return (
    <div>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">
              {displaySymbol} <span className="font-normal text-muted">{displayName}</span>
            </h2>
            {quote && quote.price !== null ? (
              <>
                <div className="mt-1 text-2xl font-extrabold">{formatStockPrice(quote.price, quote.currency)}</div>
                <div className={`text-sm font-semibold ${percentColorClass(quote.changePercent)}`}>
                  {quote.change !== null ? formatStockPrice(quote.change, quote.currency) : t("stocksPage.unavailable")} ({formatPercent(quote.changePercent)})
                </div>
              </>
            ) : (
              <div className="mt-1 text-sm text-muted">{loading ? t("common.loading") : t("stocksPage.providerUnavailable")}</div>
            )}
          </div>
        </div>
        {quote && (
          <p className="mt-2 text-[11px] text-muted">
            {t("stocksPage.source", { source: quote.source })} · {t("stocksPage.lastUpdated", { time: formatRelativeTime(quote.updatedAt, locale) })}
          </p>
        )}

        {showThaiGoldIndicative && thaiGoldIndicative !== null && (
          <div className="mt-3 rounded-xl border border-amber/30 bg-amber/10 p-3">
            <span className="rounded-full bg-amber/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber">
              {t("goldFxPage.indicativeLabel")}
            </span>
            <div className="mt-1 text-lg font-bold">{formatStockPrice(thaiGoldIndicative, "THB")}</div>
            <p className="mt-1 text-[11px] text-muted">{t("goldFxPage.indicativeDisclaimer")}</p>
          </div>
        )}

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
        {!loading && chart.length === 0 && <p className="mt-2 text-center text-xs text-muted">{t("stocksPage.chartUnavailable")}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          <Btn variant="gold" onClick={() => setAction("watch")}>
            {t("stocksPage.watch")}
          </Btn>
          <Btn onClick={() => setAction("holding")}>{t("stocksPage.addHolding")}</Btn>
          <Btn onClick={() => setAction("alert")}>{t("stocksPage.priceAlert")}</Btn>
          <Btn onClick={() => setAction("note")}>{t("stocksPage.note")}</Btn>
        </div>
      </Card>

      <SectionHead title={t("stocksPage.relatedNews", { symbol: displaySymbol })} />
      <Card>
        {marketNews.length === 0 && <p className="text-sm text-muted">{t("stocksPage.noNews")}</p>}
        {marketNews.map((n) => (
          <NewsCard key={n.id} article={n} saved={savedKeys.has(n.dedupe_key)} onOpen={() => setSelectedArticle(n)} onToggleSave={() => toggleSave(n)} />
        ))}
      </Card>

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
