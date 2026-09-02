"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RESOURCES } from "@/lib/resources";
import { ALL_NAV } from "@/components/nav-config";
import { Sheet } from "@/components/ui";
import { useI18n } from "@/lib/i18n/context";
import { translateResourceLabel } from "@/lib/i18n";

type Hit = { table: string; id: string; title: string; subtitle: string; nav?: string };

const SEARCHABLE = Object.values(RESOURCES).filter((r) => r.searchKeys?.length);

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setQ("");
      setHits([]);
    }
  }, [open]);

  const navHits: Hit[] = useMemo(() => {
    if (!q) return [];
    const lower = q.toLowerCase();
    return ALL_NAV.filter((n) => t(n.labelKey).toLowerCase().includes(lower)).map((n) => ({
      table: "nav",
      id: n.href,
      title: t(n.labelKey),
      subtitle: t("search.goToSection"),
      nav: n.href,
    }));
  }, [q, t]);

  useEffect(() => {
    if (!q || q.length < 2) {
      setHits([]);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const timer = setTimeout(async () => {
      const results: Hit[] = [];
      await Promise.all(
        SEARCHABLE.map(async (r) => {
          const orFilter = (r.searchKeys || []).map((k) => `${k}.ilike.%${q}%`).join(",");
          const { data } = await supabase.from(r.table as any).select("*").or(orFilter).limit(5);
          (data || []).forEach((row: any) => {
            results.push({
              table: r.table,
              id: row.id,
              title: String(row[r.titleKey] ?? "(untitled)"),
              subtitle: translateResourceLabel(locale, r.key, "labelPlural", r.labelPlural),
            });
          });
        })
      );
      setHits(results);
      setBusy(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [q, locale]);

  const combined = [...navHits, ...hits];

  return (
    <Sheet open={open} onClose={onClose} title={t("common.search")}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("search.placeholder")}
        className="mb-3 h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
      />
      {busy && <div className="py-2 text-sm text-muted">{t("search.searching")}</div>}
      {!busy && q.length >= 2 && combined.length === 0 && (
        <div className="py-2 text-sm text-muted">{t("search.noMatches")}</div>
      )}
      <div className="max-h-[50vh] overflow-y-auto">
        {combined.map((h) => (
          <button
            key={`${h.table}-${h.id}`}
            onClick={() => {
              onClose();
              if (h.nav) router.push(h.nav);
            }}
            className="flex w-full flex-col items-start border-b border-line py-3 text-left last:border-0"
          >
            <span className="text-sm font-semibold">{h.title}</span>
            <span className="text-xs text-muted">{h.subtitle}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
