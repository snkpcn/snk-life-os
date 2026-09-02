"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { formatStockPrice, formatPercent, percentColorClass } from "@/lib/stocks/format";
import { computeStockMovers } from "@/lib/stocks/signals";
import type { ConstituentMeta, StockQuote } from "@/lib/stocks/types";

type SortKey = "symbol" | "price" | "change";
type FilterKey = "all" | "gainers" | "losers" | "active";

const DEFAULT_VISIBLE = 12;

export function StockTable({
  constituents,
  quotes,
  selectedSymbol,
  onSelect,
  loading,
  quotesUnavailable,
  onVisibleSymbolsChange,
}: {
  constituents: ConstituentMeta[];
  quotes: StockQuote[];
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
  loading: boolean;
  /** True when the last quote fetch for the currently-needed symbols failed outright — used to
   * show an honest "data unavailable" message instead of a misleading "no matches" empty state. */
  quotesUnavailable: boolean;
  /** Fires whenever the set of rows actually on screen changes, so the parent can fetch quotes
   * for exactly those symbols instead of the whole constituent list up front. */
  onVisibleSymbolsChange: (symbols: string[]) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showAll, setShowAll] = useState(false);

  const bySymbol = useMemo(() => new Map(quotes.map((q) => [q.symbol, q])), [quotes]);
  const movers = useMemo(() => computeStockMovers(quotes), [quotes]);

  const filterSet = useMemo(() => {
    if (filter === "gainers") return new Set(movers.gainers.map((q) => q.symbol));
    if (filter === "losers") return new Set(movers.losers.map((q) => q.symbol));
    if (filter === "active") return new Set(movers.mostActive.map((q) => q.symbol));
    return null;
  }, [filter, movers]);

  const rows = useMemo(() => {
    let list = constituents.map((c) => ({ meta: c, quote: bySymbol.get(c.symbol) || null }));
    if (filterSet) list = list.filter((r) => filterSet.has(r.meta.symbol));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) => r.meta.symbol.toLowerCase().includes(q) || r.meta.name.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (sortKey === "symbol") return a.meta.symbol.localeCompare(b.meta.symbol);
      if (sortKey === "price") return (b.quote?.price ?? -Infinity) - (a.quote?.price ?? -Infinity);
      return (b.quote?.changePercent ?? -Infinity) - (a.quote?.changePercent ?? -Infinity);
    });
    return list;
  }, [constituents, bySymbol, filterSet, query, sortKey]);

  const visible = showAll ? rows : rows.slice(0, DEFAULT_VISIBLE);
  const visibleSymbolsKey = visible.map((r) => r.meta.symbol).join(",");

  useEffect(() => {
    if (visibleSymbolsKey) onVisibleSymbolsChange(visibleSymbolsKey.split(","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSymbolsKey]);

  // Only treat a filtered result as genuinely empty when real quote data was actually available
  // to filter on — otherwise "no gainers" and "data hasn't loaded" would show the same message.
  const hasAnyQuoteData = quotes.some((q) => q.price !== null);
  const emptyIsDataFailure = quotesUnavailable || (filter !== "all" && !hasAnyQuoteData);

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all", label: t("stocksPage.filterAll") },
    { key: "gainers", label: t("stocksPage.filterGainers") },
    { key: "losers", label: t("stocksPage.filterLosers") },
    { key: "active", label: t("stocksPage.filterMostActive") },
  ];

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("stocksPage.searchPlaceholder")}
        className="h-11 w-full rounded-xl border border-line bg-panel px-3 text-sm text-ink outline-none"
      />

      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${filter === f.key ? "border-gold bg-gold/10 text-gold" : "border-line text-muted"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex gap-2 text-xs">
        <span className="text-muted">{t("stocksPage.sortBy")}</span>
        {(["symbol", "price", "change"] as SortKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setSortKey(k)}
            className={`font-semibold ${sortKey === k ? "text-gold" : "text-muted"}`}
          >
            {k === "symbol" ? t("stocksPage.sortSymbol") : k === "price" ? t("stocksPage.sortPrice") : t("stocksPage.sortChange")}
          </button>
        ))}
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[320px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-panel2 text-left text-[11px] uppercase text-muted">
              <th className="px-3 py-2 font-semibold">{t("stocksPage.colSymbol")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("stocksPage.colPrice")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("stocksPage.colChange")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-xs text-muted">
                  {loading ? t("common.loading") : emptyIsDataFailure ? t("stocksPage.marketDataUnavailable") : t("stocksPage.noResults")}
                </td>
              </tr>
            )}
            {visible.map((r) => (
              <tr
                key={r.meta.symbol}
                onClick={() => onSelect(r.meta.symbol)}
                aria-selected={r.meta.symbol === selectedSymbol}
                className={`h-[44px] min-h-[44px] cursor-pointer border-b border-line last:border-0 ${r.meta.symbol === selectedSymbol ? "bg-gold/10" : ""}`}
              >
                <td className="max-w-[140px] px-3 py-2">
                  <div className="font-bold">{r.meta.symbol}</div>
                  <div className="truncate text-[11px] text-muted">{r.meta.name}</div>
                </td>
                <td className="px-3 py-2 text-right font-semibold">{r.quote ? formatStockPrice(r.quote.price, r.quote.currency) : t("stocksPage.unavailable")}</td>
                <td className={`px-3 py-2 text-right font-semibold ${percentColorClass(r.quote?.changePercent ?? null)}`}>
                  {r.quote ? formatPercent(r.quote.changePercent) : t("stocksPage.unavailable")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > DEFAULT_VISIBLE && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs font-bold text-gold">
          {showAll ? t("stocksPage.showLess") : t("stocksPage.viewAll", { count: rows.length })}
        </button>
      )}
    </div>
  );
}
