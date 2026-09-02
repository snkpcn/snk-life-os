"use client";

import { useEffect, useMemo, useState } from "react";
import { Btn, Sheet } from "@/components/ui";
import { ResourceForm } from "@/components/resource-form";
import { RESOURCES } from "@/lib/resources";
import { CryptoChart } from "@/components/crypto/crypto-chart";
import { NewsCard } from "@/components/news-card";
import { StockHeader } from "@/components/stocks/stock-header";
import { useI18n } from "@/lib/i18n/context";
import type { ConstituentMeta, StockChartPoint, StockChartRange, StockMarket, StockQuote } from "@/lib/stocks/types";
import type { NewsArticle } from "@/lib/news/types";

const RANGES: StockChartRange[] = ["1D", "5D", "1M", "3M", "6M", "1Y", "5Y"];
type ActionKind = "watch" | "holding" | "alert" | "note" | null;

/** Opens immediately on row tap as a bottom sheet — this is the actual mobile "open the
 * stock" interaction, not just an inline card the user has to scroll back up to see. */
export function StockDetailSheet({
  symbol,
  market,
  meta,
  marketNews,
  savedKeys,
  onToggleSave,
  onOpenArticle,
  onClose,
}: {
  symbol: string | null;
  market: StockMarket;
  meta: ConstituentMeta | null;
  marketNews: NewsArticle[];
  savedKeys: Set<string>;
  onToggleSave: (article: NewsArticle) => void;
  onOpenArticle: (article: NewsArticle) => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [chart, setChart] = useState<StockChartPoint[]>([]);
  const [range, setRange] = useState<StockChartRange>("1M");
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<ActionKind>(null);
  const [askInput, setAskInput] = useState("");
  const [askReply, setAskReply] = useState<string | null>(null);
  const [askBusy, setAskBusy] = useState(false);

  useEffect(() => {
    setQuote(null);
    setChart([]);
    setAction(null);
    setAskReply(null);
    setRange("1M");
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/stocks/chart?symbol=${encodeURIComponent(symbol)}&market=${market}&range=${range}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setQuote(data.quote || null);
        setChart(data.chart || []);
      })
      .catch(() => {
        if (!cancelled) {
          setQuote(null);
          setChart([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, market, range]);

  const relatedNews = useMemo(() => {
    if (!meta) return [];
    const keywords = [meta.symbol.toLowerCase(), meta.name.toLowerCase()];
    return marketNews.filter((a) => keywords.some((k) => a.headline.toLowerCase().includes(k) || a.summary.toLowerCase().includes(k))).slice(0, 4);
  }, [marketNews, meta]);

  async function ask(question: string) {
    if (!meta || !question.trim() || askBusy) return;
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
            symbol: meta.symbol,
            name: meta.name,
            market,
            price: quote?.price ?? null,
            changePercent: quote?.changePercent ?? null,
            currency: quote?.currency || (market === "TH" ? "THB" : "USD"),
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

  if (!symbol || !meta) return null;

  const exchangeLabel = market === "TH" ? "SET" : quote?.exchange || "US";
  const currency = quote?.currency || (market === "TH" ? "THB" : "USD");

  if (action) {
    const resource =
      action === "watch" ? RESOURCES.watchlist_items : action === "holding" ? RESOURCES.holdings : action === "alert" ? RESOURCES.price_alerts : RESOURCES.notes_table;
    const prefill =
      action === "watch"
        ? { ticker: meta.symbol, name: meta.name, market: exchangeLabel }
        : action === "holding"
          ? { ticker: meta.symbol, name: meta.name, market: exchangeLabel, asset_class: "Stock", currency }
          : action === "alert"
            ? { symbol: meta.symbol, market: exchangeLabel, currency }
            : { title: `${meta.name} (${meta.symbol})` };
    return (
      <Sheet open={symbol !== null} onClose={onClose} title={meta.symbol} wide>
        <ResourceForm resource={resource} prefill={prefill} onCancel={() => setAction(null)} onSaved={() => setAction(null)} />
      </Sheet>
    );
  }

  return (
    <Sheet open={symbol !== null} onClose={onClose} title={meta.symbol} wide>
      <div className="space-y-4">
        <StockHeader symbol={meta.symbol} name={meta.name} quote={quote} loading={loading} />

        <div className="flex flex-wrap gap-2">
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
        <div className="rounded-xl border border-line bg-bg p-2">
          <CryptoChart points={chart} height={240} />
        </div>
        {!loading && chart.length === 0 && <p className="text-center text-xs text-muted">{t("stocksPage.chartUnavailable")}</p>}

        <div className="flex flex-wrap gap-2">
          <Btn variant="gold" onClick={() => setAction("watch")}>
            {t("stocksPage.watch")}
          </Btn>
          <Btn onClick={() => setAction("holding")}>{t("stocksPage.addHolding")}</Btn>
          <Btn onClick={() => setAction("alert")}>{t("stocksPage.priceAlert")}</Btn>
          <Btn onClick={() => setAction("note")}>{t("stocksPage.note")}</Btn>
        </div>

        {relatedNews.length > 0 && (
          <div>
            <b className="mb-2 block text-xs uppercase tracking-wide text-gold">{t("stocksPage.relatedNews", { symbol: meta.symbol })}</b>
            {relatedNews.map((n) => (
              <NewsCard key={n.id} article={n} saved={savedKeys.has(n.dedupe_key)} onOpen={() => onOpenArticle(n)} onToggleSave={() => onToggleSave(n)} />
            ))}
          </div>
        )}

        <div className="rounded-xl border border-line bg-bg p-3">
          <b className="mb-2 block text-xs uppercase tracking-wide text-gold">{t("stocksPage.askStark")}</b>
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
        </div>
      </div>
    </Sheet>
  );
}
