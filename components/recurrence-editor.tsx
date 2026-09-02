"use client";

import { useI18n } from "@/lib/i18n/context";
import type { RecurrenceFreq, RecurrenceRule } from "@/lib/recurrence";

const WEEKDAYS: { value: number; key: string }[] = [
  { value: 0, key: "sun" },
  { value: 1, key: "mon" },
  { value: 2, key: "tue" },
  { value: 3, key: "wed" },
  { value: 4, key: "thu" },
  { value: 5, key: "fri" },
  { value: 6, key: "sat" },
];

type EndMode = "never" | "on_date" | "after_count";

function endModeOf(rule: RecurrenceRule): EndMode {
  if (rule.until) return "on_date";
  if (rule.count) return "after_count";
  return "never";
}

export function RecurrenceEditor({
  value,
  onChange,
  defaultWeekday,
}: {
  value: RecurrenceRule | null;
  onChange: (rule: RecurrenceRule | null) => void;
  defaultWeekday: number;
}) {
  const { t } = useI18n();
  const inputClass = "h-11 rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold";

  if (!value) {
    return (
      <label className="flex items-center justify-between rounded-xl border border-line bg-bg px-3 py-3">
        <span className="text-sm text-muted">{t("schedulePage.repeat")}</span>
        <input
          type="checkbox"
          checked={false}
          onChange={(e) => e.target.checked && onChange({ freq: "weekly", interval: 1, byweekday: [defaultWeekday] })}
          className="h-5 w-5 accent-gold"
        />
      </label>
    );
  }

  const endMode = endModeOf(value);

  function update(patch: Partial<RecurrenceRule>) {
    onChange({ ...value!, ...patch });
  }

  function setEndMode(mode: EndMode) {
    if (mode === "never") update({ until: null, count: null });
    else if (mode === "on_date") update({ until: new Date().toISOString().slice(0, 10), count: null });
    else update({ until: null, count: 5 });
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-bg p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{t("schedulePage.repeat")}</span>
        <button type="button" onClick={() => onChange(null)} className="text-xs text-red">
          {t("schedulePage.repeatNone")}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">{t("schedulePage.every")}</span>
        <input
          type="number"
          min={1}
          value={value.interval}
          onChange={(e) => update({ interval: Math.max(1, Number(e.target.value) || 1) })}
          className={`${inputClass} w-16`}
        />
        <select
          value={value.freq}
          onChange={(e) => update({ freq: e.target.value as RecurrenceFreq, byweekday: e.target.value === "weekly" ? value.byweekday || [defaultWeekday] : undefined })}
          className={`${inputClass} flex-1`}
        >
          <option value="daily">{t("schedulePage.unit.daily")}</option>
          <option value="weekly">{t("schedulePage.unit.weekly")}</option>
          <option value="monthly">{t("schedulePage.unit.monthly")}</option>
          <option value="yearly">{t("schedulePage.unit.yearly")}</option>
        </select>
      </div>

      {value.freq === "weekly" && (
        <div className="flex flex-wrap gap-1">
          {WEEKDAYS.map((wd) => {
            const active = (value.byweekday || []).includes(wd.value);
            return (
              <button
                key={wd.value}
                type="button"
                onClick={() => {
                  const current = new Set(value.byweekday || []);
                  if (current.has(wd.value)) current.delete(wd.value);
                  else current.add(wd.value);
                  update({ byweekday: Array.from(current) });
                }}
                className={`h-9 w-9 rounded-full text-xs font-bold ${active ? "bg-gold text-[#17130c]" : "border border-line text-muted"}`}
              >
                {t(`schedulePage.weekday.${wd.key}`)}
              </button>
            );
          })}
        </div>
      )}

      <div>
        <span className="mb-1 block text-xs text-muted">{t("schedulePage.endCondition")}</span>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-xs">
            <input type="radio" checked={endMode === "never"} onChange={() => setEndMode("never")} />
            {t("schedulePage.endNever")}
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input type="radio" checked={endMode === "on_date"} onChange={() => setEndMode("on_date")} />
            {t("schedulePage.endOnDate")}
          </label>
          {endMode === "on_date" && (
            <input type="date" value={value.until || ""} onChange={(e) => update({ until: e.target.value })} className={`${inputClass} text-xs`} />
          )}
          <label className="flex items-center gap-1 text-xs">
            <input type="radio" checked={endMode === "after_count"} onChange={() => setEndMode("after_count")} />
            {t("schedulePage.endAfterCount")}
          </label>
          {endMode === "after_count" && (
            <>
              <input
                type="number"
                min={1}
                value={value.count || 1}
                onChange={(e) => update({ count: Math.max(1, Number(e.target.value) || 1) })}
                className={`${inputClass} w-16 text-xs`}
              />
              <span className="text-xs text-muted">{t("schedulePage.occurrencesSuffix")}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
