import { en, type Dict } from "./en";
import { th } from "./th";

export type Locale = "th" | "en";

export const LOCALE_COOKIE = "snk_locale";
export const LOCALE_STORAGE_KEY = "snk_locale";

const dictionaries: Record<Locale, Dict> = { en, th };

export function getDictionary(locale: Locale): Dict {
  return dictionaries[locale] ?? dictionaries.th;
}

export function isLocale(value: unknown): value is Locale {
  return value === "th" || value === "en";
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
}

/** Plain (non-hook) translator, safe for server components. Falls back en -> humanized key. */
export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const primary = getByPath(dictionaries[locale], key);
  if (typeof primary === "string") return interpolate(primary, vars);
  const fallback = getByPath(dictionaries.en, key);
  if (typeof fallback === "string") return interpolate(fallback, vars);
  const last = key.split(".").pop() || key;
  return last.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Resource label ("Task"/"งาน") for a resource key, with a safe fallback to the given default. */
export function translateResourceLabel(locale: Locale, resourceKey: string, field: "label" | "labelPlural", fallback: string) {
  const value = getByPath(dictionaries[locale], `resourceMeta.${resourceKey}.${field}`);
  return typeof value === "string" ? value : fallback;
}

/** Field label for a resource+field combination, checking per-resource override first, then the shared field dictionary. */
export function translateFieldLabel(locale: Locale, resourceKey: string, fieldKey: string, fallback: string) {
  const overrides = dictionaries[locale].fieldLabelOverride as Record<string, string>;
  const override = overrides[`${resourceKey}.${fieldKey}`];
  if (typeof override === "string") return override;
  const generic = (dictionaries[locale].fieldLabel as Record<string, string>)[fieldKey];
  return typeof generic === "string" ? generic : fallback;
}

/** Option value label (e.g. "active" -> "Active" / "ดำเนินการอยู่"), fallback to the raw value. */
export function translateOption(locale: Locale, value: string, fallback: string) {
  const found = getByPath(dictionaries[locale], `optionLabel.${value}`);
  return typeof found === "string" ? found : fallback;
}

export type { Dict };
