import type { Locale } from "@/lib/i18n";

const BANGKOK_TZ = "Asia/Bangkok";

function intlLocale(locale?: Locale) {
  return locale === "th" ? "th-TH" : "en-US";
}

export function formatMoney(value: number | null | undefined, currency = "THB", locale?: Locale) {
  if (value === null || value === undefined) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const loc = intlLocale(locale);
  if (abs >= 1_000_000) {
    const millions = (abs / 1_000_000).toFixed(abs % 1_000_000 ? 1 : 0);
    return `${sign}${millions}${locale === "th" ? "ล้าน" : "M"} ${currency}`;
  }
  return `${sign}${abs.toLocaleString(loc, { maximumFractionDigits: 2 })} ${currency}`;
}

export function formatDate(value: string | null | undefined, locale?: Locale) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: BANGKOK_TZ,
  });
}

export function formatDateTime(value: string | null | undefined, locale?: Locale) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString(intlLocale(locale), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BANGKOK_TZ,
  });
}

export function formatRelativeTime(value: string | null | undefined, locale?: Locale) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const diffMs = d.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  return rtf.format(diffDay, "day");
}

export function toDateInputValue(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

export function toDateTimeInputValue(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
