"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function Tabs({
  tabs,
  paramKey = "tab",
}: {
  tabs: { key: string; label: string }[];
  paramKey?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get(paramKey) || tabs[0].key;

  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => router.replace(`${pathname}?${paramKey}=${t.key}`)}
          className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold ${
            active === t.key ? "border-gold bg-gold/10 text-gold" : "border-line text-muted"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function useActiveTab(tabs: { key: string; label: string }[], paramKey = "tab") {
  const searchParams = useSearchParams();
  return searchParams.get(paramKey) || tabs[0].key;
}
