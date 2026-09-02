"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/supabase/useUser";
import { Btn, Card, SectionHead } from "@/components/ui";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n/context";

type Profile = { display_name: string | null; currency: string; timezone: string; start_of_week: string };
type NewsPrefs = {
  daily_brief_enabled: boolean;
  world_enabled: boolean;
  thailand_enabled: boolean;
  thairath_enabled: boolean;
  business_enabled: boolean;
  markets_enabled: boolean;
  tech_enabled: boolean;
  stories_on_today: number;
};

const DEFAULT_NEWS_PREFS: NewsPrefs = {
  daily_brief_enabled: true,
  world_enabled: true,
  thailand_enabled: true,
  thairath_enabled: true,
  business_enabled: true,
  markets_enabled: true,
  tech_enabled: true,
  stories_on_today: 3,
};

export default function SettingsPage() {
  const { user } = useUser();
  const { t } = useI18n();
  const [profile, setProfile] = useState<Profile>({
    display_name: "",
    currency: "THB",
    timezone: "Asia/Bangkok",
    start_of_week: "monday",
  });
  const [newsPrefs, setNewsPrefs] = useState<NewsPrefs>(DEFAULT_NEWS_PREFS);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newsBusy, setNewsBusy] = useState(false);
  const [newsSaved, setNewsSaved] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("display_name, currency, timezone, start_of_week")
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfile(data as Profile);
      });
    supabase
      .from("news_preferences")
      .select("*")
      .maybeSingle()
      .then(({ data }) => {
        if (data) setNewsPrefs({ ...DEFAULT_NEWS_PREFS, ...(data as Partial<NewsPrefs>) });
      });
  }, []);

  async function save() {
    setBusy(true);
    setSaved(false);
    const supabase = createClient();
    await supabase.from("profiles").upsert({ id: user?.id, ...profile } as any);
    setBusy(false);
    setSaved(true);
  }

  async function saveNewsPrefs(next: NewsPrefs) {
    setNewsPrefs(next);
    setNewsBusy(true);
    setNewsSaved(false);
    const supabase = createClient();
    await supabase.from("news_preferences").upsert({ owner_id: user?.id, ...next } as any);
    setNewsBusy(false);
    setNewsSaved(true);
  }

  return (
    <div>
      <SectionHead title={t("settings.title")} subtitle={user?.email || undefined} />

      <Card className="mb-4 flex items-center justify-between">
        <div>
          <b className="block text-sm">{t("settings.language")}</b>
          <small className="text-muted">{t("settings.languageHint")}</small>
        </div>
        <LanguageSwitcher />
      </Card>

      <Card className="space-y-3">
        <div>
          <label className="mb-1 block text-[11px] text-muted">{t("settings.displayName")}</label>
          <input
            value={profile.display_name || ""}
            onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))}
            className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted">{t("settings.currency")}</label>
          <input
            value={profile.currency || ""}
            onChange={(e) => setProfile((p) => ({ ...p, currency: e.target.value }))}
            className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted">{t("settings.timezone")}</label>
          <input
            value={profile.timezone || ""}
            onChange={(e) => setProfile((p) => ({ ...p, timezone: e.target.value }))}
            className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted">{t("settings.startOfWeek")}</label>
          <select
            value={profile.start_of_week}
            onChange={(e) => setProfile((p) => ({ ...p, start_of_week: e.target.value }))}
            className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
          >
            <option value="sunday">{t("settings.sunday")}</option>
            <option value="monday">{t("settings.monday")}</option>
          </select>
        </div>
        <Btn variant="gold" onClick={save} disabled={busy}>
          {busy ? t("settings.save") + "…" : t("settings.save")}
        </Btn>
        {saved && <span className="ml-3 text-sm text-green">{t("settings.saved")}</span>}
      </Card>

      <SectionHead title={t("settings.newsSectionTitle")} subtitle={t("settings.newsSectionSubtitle")} />
      <Card className="space-y-3">
        {(
          [
            ["daily_brief_enabled", "newsDailyBrief"],
            ["world_enabled", "newsWorld"],
            ["thailand_enabled", "newsThailand"],
            ["thairath_enabled", "newsThairath"],
            ["business_enabled", "newsBusiness"],
            ["markets_enabled", "newsMarkets"],
            ["tech_enabled", "newsTech"],
          ] as const
        ).map(([key, labelKey]) => (
          <label key={key} className="flex items-center justify-between rounded-xl border border-line bg-bg px-3 py-3">
            <span className="text-sm">{t(`settings.${labelKey}`)}</span>
            <input
              type="checkbox"
              checked={newsPrefs[key]}
              onChange={(e) => saveNewsPrefs({ ...newsPrefs, [key]: e.target.checked })}
              className="h-5 w-5 accent-gold"
            />
          </label>
        ))}
        <div>
          <label className="mb-1 block text-[11px] text-muted">{t("settings.newsStoriesOnToday")}</label>
          <select
            value={newsPrefs.stories_on_today}
            onChange={(e) => saveNewsPrefs({ ...newsPrefs, stories_on_today: Number(e.target.value) })}
            className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
          >
            <option value={3}>3</option>
            <option value={5}>5</option>
          </select>
        </div>
        {newsBusy && <span className="text-sm text-muted">{t("common.saving")}</span>}
        {newsSaved && !newsBusy && <span className="text-sm text-green">{t("settings.saved")}</span>}
      </Card>
    </div>
  );
}
