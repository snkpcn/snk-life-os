"use client";

import { useEffect, useState } from "react";
import { Btn, Sheet } from "@/components/ui";
import { ResourceForm } from "@/components/resource-form";
import { RESOURCES } from "@/lib/resources";
import { CryptoChart } from "@/components/crypto/crypto-chart";
import { formatCompactUsd, formatPercent, formatUsdPrice, percentColorClass } from "@/lib/crypto/format";
import { formatRelativeTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";
import type { CryptoAsset, CryptoChartPoint, CryptoChartRange } from "@/lib/crypto/types";
import type { NewsArticle } from "@/lib/news/types";

const RANGES: CryptoChartRange[] = ["1D", "5D", "1M", "3M", "6M", "1Y", "5Y"];

type ActionKind = "watch" | "holding" | "alert" | "note" | null;

export function CryptoDetailSheet({ coinId, onClose }: { coinId: string | null; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [asset, setAsset] = useState<CryptoAsset | null>(null);
  const [chart, setChart] = useState<CryptoChartPoint[]>([]);
  const [range, setRange] = useState<CryptoChartRange>("1M");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [action, setAction] = useState<ActionKind>(null);
  const [relatedNews, setRelatedNews] = useState<NewsArticle[] | null>(null);
  const [askInput, setAskInput] = useState("");
  const [askReply, setAskReply] = useState<string | null>(null);
  const [askBusy, setAskBusy] = useState(false);

  useEffect(() => {
    if (!coinId) return;
    setAsset(null);
    setFailed(false);
    setRelatedNews(null);
    setAction(null);
    setAskReply(null);
    setRange("1M");
  }, [coinId]);

  useEffect(() => {
    if (!coinId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/crypto/coin/${coinId}?range=${range}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setAsset(data.asset);
        setChart(data.chart || []);
        setFailed(!data.asset);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [coinId, range]);

  useEffect(() => {
    if (!asset) return;
    let cancelled = false;
    (async () => {
      try {
        const [biz, markets] = await Promise.all([
          fetch(`/api/news?category=business&lang=${locale}`).then((r) => (r.ok ? r.json() : { articles: [] })),
          fetch(`/api/news?category=markets&lang=${locale}`).then((r) => (r.ok ? r.json() : { articles: [] })),
        ]);
        if (cancelled) return;
        const pool: NewsArticle[] = [...(biz.articles || []), ...(markets.articles || [])];
        const keywords = [asset.name.toLowerCase(), asset.symbol.toLowerCase()];
        const matched = pool.filter((a) => keywords.some((k) => a.headline.toLowerCase().includes(k) || a.summary.toLowerCase().includes(k)));
        setRelatedNews(matched.slice(0, 4));
      } catch {
        if (!cancelled) setRelatedNews([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [asset, locale]);

  async function ask(question: string) {
    if (!asset || !question.trim() || askBusy) return;
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
          crypto: {
            id: asset.id,
            symbol: asset.symbol,
            name: asset.name,
            price: asset.price,
            change24h: asset.change24h,
            change7d: asset.change7d,
            marketCap: asset.marketCap,
            marketCapRank: asset.marketCapRank,
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

  if (action && asset) {
    const resource =
      action === "watch" ? RESOURCES.watchlist_items : action === "holding" ? RESOURCES.holdings : action === "alert" ? RESOURCES.price_alerts : RESOURCES.notes_table;
    const prefill =
      action === "watch"
        ? { ticker: asset.symbol, name: asset.name, market: "Crypto" }
        : action === "holding"
          ? { ticker: asset.symbol, name: asset.name, market: "Crypto", asset_class: "Crypto", currency: "USD" }
          : action === "alert"
            ? { symbol: asset.symbol, market: "Crypto", currency: "USD" }
            : { title: `${asset.name} (${asset.symbol})` };
    return (
      <Sheet open={coinId !== null} onClose={onClose} title={t("cryptoPage.coinDetail")} wide>
        <ResourceForm resource={resource} prefill={prefill} onCancel={() => setAction(null)} onSaved={() => setAction(null)} />
      </Sheet>
    );
  }

  return (
    <Sheet open={coinId !== null} onClose={onClose} title={t("cryptoPage.coinDetail")} wide>
      {loading && !asset && <p className="text-sm text-muted">{t("common.loading")}</p>}
      {failed && !loading && <p className="text-sm text-muted">{t("cryptoPage.providerUnavailable")}</p>}
      {asset && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {asset.image && <img src={asset.image} alt="" className="h-10 w-10 rounded-full" />}
            <div>
              <h2 className="text-lg font-bold">
                {asset.name} <span className="text-muted">{asset.symbol}</span>
              </h2>
              <div className="text-2xl font-extrabold">{formatUsdPrice(asset.price)}</div>
            </div>
          </div>

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
            <CryptoChart points={chart} />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label={t("cryptoPage.change24h")} value={formatPercent(asset.change24h)} className={percentColorClass(asset.change24h)} />
            <Stat label={t("cryptoPage.change7d")} value={formatPercent(asset.change7d)} className={percentColorClass(asset.change7d)} />
            <Stat label={t("cryptoPage.marketCapRank")} value={asset.marketCapRank ? `#${asset.marketCapRank}` : t("cryptoPage.unavailable")} />
            <Stat label={t("cryptoPage.marketCap")} value={formatCompactUsd(asset.marketCap)} />
            <Stat label={t("cryptoPage.volume24h")} value={formatCompactUsd(asset.volume24h)} />
            <Stat label={t("cryptoPage.high24h")} value={formatUsdPrice(asset.high24h)} />
            <Stat label={t("cryptoPage.low24h")} value={formatUsdPrice(asset.low24h)} />
          </div>

          <p className="text-xs text-muted">
            {t("cryptoPage.source", { source: asset.source })} · {t("cryptoPage.lastUpdated", { time: formatRelativeTime(asset.updatedAt, locale) })}
          </p>

          <div className="flex flex-wrap gap-2">
            <Btn variant="gold" onClick={() => setAction("watch")}>
              {t("cryptoPage.watch")}
            </Btn>
            <Btn onClick={() => setAction("holding")}>{t("cryptoPage.addHolding")}</Btn>
            <Btn onClick={() => setAction("alert")}>{t("cryptoPage.priceAlert")}</Btn>
            <Btn onClick={() => setAction("note")}>{t("cryptoPage.note")}</Btn>
          </div>

          {relatedNews !== null && relatedNews.length > 0 && (
            <div className="rounded-xl border border-line bg-bg p-3">
              <b className="mb-2 block text-xs uppercase tracking-wide text-gold">{t("cryptoPage.relatedNews")}</b>
              {relatedNews.map((n) => (
                <a key={n.id} href={n.article_url} target="_blank" rel="noreferrer" className="block border-b border-line py-2 text-sm last:border-0">
                  {n.headline}
                  <span className="mt-0.5 block text-[11px] text-muted">{t("cryptoPage.possibleContributingFactor")}</span>
                </a>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-line bg-bg p-3">
            <b className="mb-2 block text-xs uppercase tracking-wide text-gold">{t("cryptoPage.askStark")}</b>
            {askBusy && <p className="text-sm text-muted">{t("starkPage.thinking")}</p>}
            {askReply && <p className="whitespace-pre-wrap text-sm leading-relaxed">{askReply}</p>}
            <div className="mt-2 flex gap-2">
              <input
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask(askInput)}
                placeholder={t("starkPage.placeholder")}
                className="h-11 flex-1 rounded-xl border border-line bg-panel px-3 text-sm text-ink outline-none"
              />
              <Btn variant="gold" onClick={() => ask(askInput)} disabled={askBusy}>
                {t("cryptoPage.askStark")}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg border border-line bg-bg p-2">
      <div className="text-[10px] text-muted">{label}</div>
      <div className={`text-sm font-bold ${className || ""}`}>{value}</div>
    </div>
  );
}
