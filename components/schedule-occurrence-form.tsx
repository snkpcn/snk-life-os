"use client";

import { useState } from "react";
import { Btn } from "@/components/ui";
import { useI18n } from "@/lib/i18n/context";
import { translateOption } from "@/lib/i18n";
import { toDateTimeInputValue } from "@/lib/format";
import { saveOccurrenceOverride } from "@/lib/schedule-actions";
import type { ScheduleOccurrence } from "@/lib/schedule-occurrences";

const STATUS_OPTIONS = ["scheduled", "done", "cancelled"];

export function ScheduleOccurrenceForm({ occurrence, onCancel, onSaved }: { occurrence: ScheduleOccurrence; onCancel: () => void; onSaved: () => void }) {
  const { t, locale } = useI18n();
  const [title, setTitle] = useState(occurrence.title);
  const [startTime, setStartTime] = useState(occurrence.start_time);
  const [endTime, setEndTime] = useState(occurrence.end_time);
  const [location, setLocation] = useState(occurrence.location || "");
  const [status, setStatus] = useState(occurrence.status || "scheduled");
  const [notes, setNotes] = useState(occurrence.notes || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await saveOccurrenceOverride(occurrence.masterId, occurrence.occurrenceDate, {
      title,
      start_time: startTime,
      end_time: endTime,
      location,
      status,
      notes,
    });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
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
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[11px] text-muted">{t("schedulePage.start")}</label>
          <input
            required
            type="datetime-local"
            value={toDateTimeInputValue(startTime)}
            onChange={(e) => setStartTime(e.target.value ? new Date(e.target.value).toISOString() : startTime)}
            className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted">{t("schedulePage.end")}</label>
          <input
            type="datetime-local"
            value={toDateTimeInputValue(endTime)}
            onChange={(e) => setEndTime(e.target.value ? new Date(e.target.value).toISOString() : null)}
            className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[11px] text-muted">{t("fieldLabel.status")}</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
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
        <label className="mb-1 block text-[11px] text-muted">{t("fieldLabel.location")}</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
        />
      </div>
      <div>
        <label className="mb-1 block text-[11px] text-muted">{t("fieldLabel.notes")}</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
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
