import { createClient } from "@/lib/supabase/client";
import { parseRRule, stringifyRRule, type RecurrenceRule } from "@/lib/recurrence";

export type ScheduleFormValues = {
  title: string;
  start_time: string; // ISO
  end_time: string | null; // ISO
  all_day: boolean;
  category: string | null;
  status: string | null;
  priority: string | null;
  location: string | null;
  business_id: string | null;
  project_id: string | null;
  notes: string | null;
};

export async function upsertSeries(values: ScheduleFormValues, rule: RecurrenceRule | null, existingId?: string) {
  const supabase = createClient();
  const payload = { ...values, rrule: rule ? stringifyRRule(rule) : null };
  if (existingId) {
    return supabase.from("schedule_events").update(payload).eq("id", existingId);
  }
  return supabase.from("schedule_events").insert(payload);
}

export async function deleteSeries(masterId: string) {
  const supabase = createClient();
  return supabase.from("schedule_events").delete().eq("id", masterId);
}

export async function skipOccurrence(masterId: string, occurrenceDate: string) {
  const supabase = createClient();
  return supabase
    .from("schedule_event_occurrences")
    .upsert({ master_event_id: masterId, occurrence_date: occurrenceDate, action: "skipped" }, { onConflict: "master_event_id,occurrence_date" });
}

export async function saveOccurrenceOverride(
  masterId: string,
  occurrenceDate: string,
  fields: Partial<{ title: string; start_time: string; end_time: string | null; location: string | null; category: string | null; status: string | null; notes: string | null }>
) {
  const supabase = createClient();
  return supabase
    .from("schedule_event_occurrences")
    .upsert({ master_event_id: masterId, occurrence_date: occurrenceDate, action: "modified", ...fields }, { onConflict: "master_event_id,occurrence_date" });
}

export async function completeOccurrence(masterId: string, occurrenceDate: string, isRecurring: boolean) {
  const supabase = createClient();
  if (!isRecurring) {
    return supabase.from("schedule_events").update({ status: "done" }).eq("id", masterId);
  }
  return supabase
    .from("schedule_event_occurrences")
    .upsert(
      { master_event_id: masterId, occurrence_date: occurrenceDate, action: "modified", status: "done", completed_at: new Date().toISOString() },
      { onConflict: "master_event_id,occurrence_date" }
    );
}

export async function getCompletionHistory(masterId: string) {
  const supabase = createClient();
  return supabase
    .from("schedule_event_occurrences")
    .select("occurrence_date, completed_at")
    .eq("master_event_id", masterId)
    .eq("status", "done")
    .order("occurrence_date", { ascending: false });
}

/** "Edit this and future events": ends the original series the day before `fromDate` and creates a
 * new series starting at `fromDate` carrying the edited values, preserving the recurrence pattern. */
export async function splitSeriesForFuture(
  originalMaster: { id: string; start_time: string; rrule: string | null },
  fromDate: string,
  newValues: ScheduleFormValues
) {
  const supabase = createClient();
  const rule = parseRRule(originalMaster.rrule);
  if (!rule) {
    return supabase.from("schedule_events").update(newValues).eq("id", originalMaster.id);
  }

  const dayBefore = new Date(`${fromDate}T00:00:00Z`);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  const trimmedRule: RecurrenceRule = { ...rule, until: dayBefore.toISOString().slice(0, 10), count: null };

  const { error: updateError } = await supabase
    .from("schedule_events")
    .update({ rrule: stringifyRRule(trimmedRule) })
    .eq("id", originalMaster.id);
  if (updateError) return { error: updateError };

  const newRule: RecurrenceRule = { ...rule, until: rule.until ?? null, count: null };
  const { data: newMaster, error: insertError } = await supabase
    .from("schedule_events")
    .insert({ ...newValues, rrule: stringifyRRule(newRule) })
    .select("id")
    .single();
  if (insertError) return { error: insertError };

  await supabase
    .from("schedule_event_occurrences")
    .update({ master_event_id: newMaster.id })
    .eq("master_event_id", originalMaster.id)
    .gte("occurrence_date", fromDate);

  return { error: null, newMasterId: newMaster.id as string };
}
