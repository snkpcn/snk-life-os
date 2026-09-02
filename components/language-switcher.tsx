"use client";

import { useI18n } from "@/lib/i18n/context";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  return (
    <div className={`flex gap-1 rounded-full border border-line bg-panel2 p-1 ${className}`} role="group" aria-label="Language">
      <button
        type="button"
        onClick={() => setLocale("th")}
        aria-pressed={locale === "th"}
        className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
          locale === "th" ? "bg-gold text-[#17130c]" : "text-muted"
        }`}
      >
        TH
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
          locale === "en" ? "bg-gold text-[#17130c]" : "text-muted"
        }`}
      >
        EN
      </button>
    </div>
  );
}
