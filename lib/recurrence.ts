export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";

export type RecurrenceRule = {
  freq: RecurrenceFreq;
  /** Repeat every N units (e.g. freq=weekly, interval=2 -> every 2 weeks). This is what covers "custom interval". */
  interval: number;
  /** Only meaningful for freq=weekly. 0=Sunday..6=Saturday. */
  byweekday?: number[];
  /** Inclusive end date, "YYYY-MM-DD". Mutually exclusive with count in the UI, but both are honored if both are set. */
  until?: string | null;
  /** Total number of occurrences, including the first. */
  count?: number | null;
};

export function parseRRule(raw: string | null | undefined): RecurrenceRule | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.freq) return parsed as RecurrenceRule;
    return null;
  } catch {
    return null;
  }
}

export function stringifyRRule(rule: RecurrenceRule): string {
  return JSON.stringify(rule);
}

const MAX_HORIZON_YEARS = 20;
const MAX_OCCURRENCES_HARD_CAP = 2000;

/** Generates the start Date of every occurrence of `rule` (anchored at `masterStart`) that falls
 * within [rangeStart, rangeEnd], while still respecting `until`/`count` limits that may lie outside
 * the requested range (so the count/until semantics are correct regardless of what window is asked for). */
export function generateOccurrences(masterStart: Date, rule: RecurrenceRule, rangeStart: Date, rangeEnd: Date): Date[] {
  const results: Date[] = [];
  const until = rule.until ? new Date(`${rule.until}T23:59:59.999Z`) : null;
  const maxCount = rule.count && rule.count > 0 ? rule.count : Infinity;
  const horizonLimit = new Date(masterStart);
  horizonLimit.setUTCFullYear(horizonLimit.getUTCFullYear() + MAX_HORIZON_YEARS);
  const hardStop = until && until < horizonLimit ? until : horizonLimit;

  let index = 0;

  function pushIfInRange(d: Date) {
    if (d >= rangeStart && d <= rangeEnd) results.push(new Date(d));
  }

  if (rule.freq === "weekly" && rule.byweekday && rule.byweekday.length > 0) {
    const sortedDays = [...new Set(rule.byweekday)].sort((a, b) => a - b);
    let weekStart = new Date(masterStart);
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
    let emittedTotal = 0;
    let weeksAdvanced = 0;

    while (weekStart <= hardStop && emittedTotal < maxCount && weeksAdvanced < 5200) {
      for (const wd of sortedDays) {
        const day = new Date(weekStart);
        day.setUTCDate(day.getUTCDate() + wd);
        day.setUTCHours(masterStart.getUTCHours(), masterStart.getUTCMinutes(), masterStart.getUTCSeconds(), masterStart.getUTCMilliseconds());
        if (day < masterStart) continue;
        if (day > hardStop) continue;
        emittedTotal++;
        if (emittedTotal > maxCount) break;
        pushIfInRange(day);
        if (results.length >= MAX_OCCURRENCES_HARD_CAP) return results;
      }
      weekStart.setUTCDate(weekStart.getUTCDate() + 7 * Math.max(1, rule.interval));
      weeksAdvanced++;
      if (weekStart > rangeEnd && weekStart > hardStop) break;
    }
    return results;
  }

  let cursor = new Date(masterStart);
  while (cursor <= hardStop && index < maxCount && index < MAX_OCCURRENCES_HARD_CAP) {
    pushIfInRange(cursor);
    index++;
    const next = new Date(cursor);
    const step = Math.max(1, rule.interval || 1);
    if (rule.freq === "daily") next.setUTCDate(next.getUTCDate() + step);
    else if (rule.freq === "weekly") next.setUTCDate(next.getUTCDate() + 7 * step);
    else if (rule.freq === "monthly") next.setUTCMonth(next.getUTCMonth() + step);
    else if (rule.freq === "yearly") next.setUTCFullYear(next.getUTCFullYear() + step);
    if (cursor > rangeEnd && next > rangeEnd && index >= maxCount) break;
    if (cursor > rangeEnd && !rule.count && !rule.until) break;
    cursor = next;
  }
  return results;
}

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Human-readable summary, e.g. "Every 2 weeks on Mon, Wed until Dec 31, 2026" — driven by the i18n dictionary. */
export function describeRecurrence(rule: RecurrenceRule, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const freqLabel = t(`schedulePage.freq.${rule.freq}`);
  const parts: string[] = [];

  if (rule.interval > 1) {
    parts.push(t("schedulePage.everyNUnit", { n: rule.interval, unit: t(`schedulePage.unit.${rule.freq}`) }));
  } else {
    parts.push(freqLabel);
  }

  if (rule.freq === "weekly" && rule.byweekday && rule.byweekday.length > 0) {
    const days = [...rule.byweekday]
      .sort((a, b) => a - b)
      .map((d) => t(`schedulePage.weekday.${WEEKDAY_KEYS[d]}`))
      .join(", ");
    parts.push(t("schedulePage.onDays", { days }));
  }

  if (rule.until) parts.push(t("schedulePage.untilDate", { date: rule.until }));
  else if (rule.count) parts.push(t("schedulePage.afterNOccurrences", { n: rule.count }));

  return parts.join(" ");
}
