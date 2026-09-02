import { generateOccurrences, parseRRule } from "@/lib/recurrence";

export type ScheduleMaster = {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  all_day: boolean | null;
  category: string | null;
  status: string | null;
  priority: string | null;
  location: string | null;
  notes: string | null;
  rrule: string | null;
};

export type ScheduleOccurrenceException = {
  id: string;
  master_event_id: string;
  occurrence_date: string;
  action: "skipped" | "modified";
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  category: string | null;
  status: string | null;
  notes: string | null;
  completed_at: string | null;
};

export type ScheduleOccurrence = {
  key: string;
  masterId: string;
  occurrenceDate: string;
  title: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  category: string | null;
  status: string | null;
  notes: string | null;
  isRecurring: boolean;
  isException: boolean;
};

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Merges master events + recorded exceptions into a flat, date-sorted occurrence list for [rangeStart, rangeEnd]. */
export function buildOccurrenceList(
  masters: ScheduleMaster[],
  exceptions: ScheduleOccurrenceException[],
  rangeStart: Date,
  rangeEnd: Date
): ScheduleOccurrence[] {
  const exceptionsByMaster = new Map<string, Map<string, ScheduleOccurrenceException>>();
  for (const ex of exceptions) {
    if (!exceptionsByMaster.has(ex.master_event_id)) exceptionsByMaster.set(ex.master_event_id, new Map());
    exceptionsByMaster.get(ex.master_event_id)!.set(ex.occurrence_date, ex);
  }

  const results: ScheduleOccurrence[] = [];

  for (const master of masters) {
    const rule = parseRRule(master.rrule);
    const masterStart = new Date(master.start_time);
    const durationMs = master.end_time ? new Date(master.end_time).getTime() - masterStart.getTime() : null;

    if (!rule) {
      if (masterStart >= rangeStart && masterStart <= rangeEnd) {
        const dateOnly = toDateOnly(masterStart);
        const ex = exceptionsByMaster.get(master.id)?.get(dateOnly);
        if (ex?.action === "skipped") continue;
        results.push(applyOverride(master, dateOnly, masterStart, master.end_time, ex));
      }
      continue;
    }

    const occurrenceDates = generateOccurrences(masterStart, rule, rangeStart, rangeEnd);
    for (const occStart of occurrenceDates) {
      const dateOnly = toDateOnly(occStart);
      const ex = exceptionsByMaster.get(master.id)?.get(dateOnly);
      if (ex?.action === "skipped") continue;
      const occEnd = durationMs !== null ? new Date(occStart.getTime() + durationMs) : null;
      results.push(applyOverride(master, dateOnly, occStart, occEnd ? occEnd.toISOString() : null, ex, true));
    }
  }

  results.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  return results;
}

function applyOverride(
  master: ScheduleMaster,
  dateOnly: string,
  occStart: Date,
  occEnd: string | null,
  ex: ScheduleOccurrenceException | undefined,
  isRecurring = false
): ScheduleOccurrence {
  return {
    key: `${master.id}:${dateOnly}`,
    masterId: master.id,
    occurrenceDate: dateOnly,
    title: ex?.title ?? master.title,
    start_time: ex?.start_time ?? occStart.toISOString(),
    end_time: ex?.end_time ?? occEnd,
    location: ex?.location ?? master.location,
    category: ex?.category ?? master.category,
    status: ex?.status ?? master.status,
    notes: ex?.notes ?? master.notes,
    isRecurring,
    isException: Boolean(ex && ex.action === "modified"),
  };
}
