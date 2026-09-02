"use client";

import { useState } from "react";
import { Btn } from "@/components/ui";
import { RecurrenceEditor } from "@/components/recurrence-editor";
import { useI18n } from "@/lib/i18n/context";
import { translateOption } from "@/lib/i18n";
import { toDateTimeInputValue } from "@/lib/format";
import { upsertSeries, splitSeriesForFuture, type ScheduleFormValues } from "@/lib/schedule-actions";
import { parseRRule, type RecurrenceRule } from "@/lib/recurrence";
import type { ScheduleMaster } from "@/lib/schedule-occurrences";

const STATUS_OPTIONS = ["scheduled", "done", "cancelled"];
const PRIORITY_OPTIONS = ["1", "2", "3"];

export function ScheduleEventForm({
  existing,
  splitFromDate,
  onCancel,
  onSaved,
}: {
  /** The master row being edited (full series edit), or null when creating a new series. */
  existing?: ScheduleMaster | null;
  /** When set, this is a "this and future events" split-edit starting at this occurrence date. */
  splitFromDate?: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { t, locale } = useI18n();
  const now = new Date();
  const [values, setValues] = useState<ScheduleFormValues>({
    title: existing?.title || "",
    start_time: existing?.start_time || now.toISOString(),
    end_time: existing?.end_time || null,
    all_day: existing?.all_day || false,
    category: existing?.category || "",
    status: existing?.status || "scheduled",
    priority: existing?.priority || "2",
    location: existing?.location || "",
    business_id: null,
    project_id: null,
    notes: existing?.notes || "",
  });
  const [rule, setRule] = useState<RecurrenceRule | null>(existing ? parseRRule(existing.rrule) : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ScheduleFormValues>(key: K, v: ScheduleFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const payload: ScheduleFormValues = { ...values };
    let result;
    if (splitFromDate && existing) {
      result = await splitSeriesForFuture(existing, splitFromDate, payload);
    } else {
      result = await upsertSeries(payload, rule, existing?.id);
    }

    setBusy(false);
    if (result?.error) {
      setError(result.error.message || String(result.error));
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-[11px] text-muted">{t("fieldLabel.title")}</label>
        <input
          required
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
        />
      </div>
      <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="min-w-0 max-w-full">
          <label className="mb-1 block text-[11px] text-muted">{t("schedulePage.start")}</label>
          <input
            required
            type="datetime-local"
            value={toDateTimeInputValue(values.start_time)}
            onChange={(e) => set("start_time", e.target.value ? new Date(e.target.value).toISOString() : values.start_time)}
            className="h-12 w-full min-w-0 max-w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
          />
        </div>
        <div className="min-w-0 max-w-full">
          <label className="mb-1 block text-[11px] text-muted">{t("schedulePage.end")}</label>
          <input
            type="datetime-local"
            value={toDateTimeInputValue(values.end_time)}
            onChange={(e) => set("end_time", e.target.value ? new Date(e.target.value).toISOString() : null)}
            className="h-12 w-full min-w-0 max-w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
          />
        </div>
      </div>

      <label className="flex items-center justify-between rounded-xl border border-line bg-bg px-3 py-3">
        <span className="text-sm text-muted">{t("schedulePage.allDay")}</span>
        <input type="checkbox" checked={values.all_day} onChange={(e) => set("all_day", e.target.checked)} className="h-5 w-5 accent-gold" />
      </label>

      {!splitFromDate && (
        <RecurrenceEditor value={rule} onChange={setRule} defaultWeekday={new Date(values.start_time).getUTCDay()} />
      )}

      <div>
        <label className="mb-1 block text-[11px] text-muted">{t("fieldLabel.category")}</label>
        <input
          value={values.category || ""}
          onChange={(e) => set("category", e.target.value)}
          className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[11px] text-muted">{t("fieldLabel.status")}</label>
          <select
            value={values.status || "scheduled"}
            onChange={(e) => set("status", e.target.value)}
            className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {translateOption(locale, o, o)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted">{t("fieldLabel.priority")}</label>
          <select
            value={values.priority || "2"}
            onChange={(e) => set("priority", e.target.value)}
            className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
          >
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {translateOption(locale, o, o)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11px] text-muted">{t("fieldLabel.location")}</label>
        <input
          value={values.location || ""}
          onChange={(e) => set("location", e.target.value)}
          className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
        />
      </div>

      <div>
        <label className="mb-1 block text-[11px] text-muted">{t("fieldLabel.notes")}</label>
        <textarea
          value={values.notes || ""}
          onChange={(e) => set("notes", e.target.value)}
          className="min-h-[80px] w-full rounded-xl border border-line bg-bg px-3 py-2 text-ink outline-none focus:border-gold"
        />
      </div>

      {error && <div className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</div>}

      <div className="grid grid-cols-2 gap-2 pt-2">
        <Btn variant="ghost" onClick={onCancel} className="border border-line">
          {t("common.cancel")}
        </Btn>
        <Btn variant="gold" type="submit" disabled={busy}>
          {busy ? t("common.saving") : t("common.save")}
        </Btn>
      </div>
    </form>
  );
}
