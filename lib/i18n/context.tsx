"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { translate, isLocale, LOCALE_COOKIE, LOCALE_STORAGE_KEY, type Locale } from "@/lib/i18n";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readClientLocale(): Locale {
  if (typeof document === "undefined") return "th";
  const cookieMatch = document.cookie.match(/(?:^|;\s*)snk_locale=(th|en)/);
  if (cookieMatch && isLocale(cookieMatch[1])) return cookieMatch[1];
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through to default
  }
  return "th";
}

function persistLocaleClientSide(locale: Locale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // best-effort only
  }
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? "th");

  // Reconcile with client-only sources (localStorage) once mounted; the server
  // already guessed from the cookie so this rarely causes a visible flash.
  useEffect(() => {
    const clientGuess = readClientLocale();
    if (clientGuess !== locale) setLocaleState(clientGuess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once authenticated, the user's saved profile.locale is the source of truth —
  // sync it in on mount and whenever a sign-in happens.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function syncFromProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase.from("profiles").select("locale").eq("id", user.id).maybeSingle();
      if (!cancelled && data && isLocale((data as { locale?: string }).locale)) {
        const dbLocale = (data as { locale: Locale }).locale;
        setLocaleState(dbLocale);
        persistLocaleClientSide(dbLocale);
      }
    }

    syncFromProfile();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") syncFromProfile();
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocaleClientSide(next);
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ locale: next }).eq("id", user.id);
      }
    })();
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(locale, key, vars), [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}
