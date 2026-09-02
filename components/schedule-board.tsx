"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Btn, Card, EmptyState, SectionHead, Sheet, ConfirmBar } from "@/components/ui";
import { ScheduleEventForm } from "@/components/schedule-event-form";
import { ScheduleOccurrenceForm } from "@/components/schedule-occurrence-form";
import { useI18n } from "@/lib/i18n/context";
import { formatDate, formatDateTime } from "@/lib/format";
import { buildOccurrenceList, type ScheduleMaster, type ScheduleOccurrenceException, type ScheduleOccurrence } from "@/lib/schedule-occurrences";
import { skipOccurrence, deleteSeries, completeOccurrence, getCompletionHistory } from "@/lib/schedule-actions";

const RANGE_DAYS = 60;

type EditScope = "this" | "future" | "series" | null;

export function ScheduleBoard() {
  const { t, locale } = useI18n();
  const [masters, setMasters] = useState<ScheduleMaster[]>([]);
  const [exceptions, setExceptions] = useState<ScheduleOccurrenceException[]>([]);
  const [occurrences, setOccurrences] = useState<ScheduleOccurrence[] | null>(null);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ key: string; type: "skip" | "delete" } | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ScheduleOccurrence | null>(null);
  const [scopeChoice, setScopeChoice] = useState<ScheduleOccurrence | null>(null);
  const [editScope, setEditScope] = useState<EditScope>(null);
  const [historyFor, setHistoryFor] = useState<ScheduleOccurrence | null>(null);
  const [history, setHistory] = useState<{ occurrence_date: string }[] | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const rangeStart = new Date();
    rangeStart.setUTCHours(0, 0, 0, 0);
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + RANGE_DAYS);

    const { data: masterRows } = await supabase
      .from("schedule_events")
      .select("id, title, start_time, end_time, all_day, category, status, priority, location, notes, rrule")
      .is("archived_at", null)
      .order("start_time", { ascending: true });
    const list = (masterRows || []) as ScheduleMaster[];
    setMasters(list);

    const ids = list.map((m) => m.id);
    let exceptionRows: ScheduleOccurrenceException[] = [];
    if (ids.length > 0) {
      const { data } = await supabase.from("schedule_event_occurrences").select("*").in("master_event_id", ids);
      exceptionRows = (data || []) as ScheduleOccurrenceException[];
    }
    setExceptions(exceptionRows);
    setOccurrences(buildOccurrenceList(list, exceptionRows, rangeStart, rangeEnd));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function findMaster(id: string) {
    return masters.find((m) => m.id === id) || null;
  }

  async function toggleComplete(occ: ScheduleOccurrence) {
    await completeOccurrence(occ.masterId, occ.occurrenceDate, occ.isRecurring);
    load();
  }

  async function runConfirmedAction() {
    if (!confirmAction) return;
    const occ = occurrences?.find((o) => o.key === confirmAction.key);
    if (!occ) return;
    if (confirmAction.type === "skip") await skipOccurrence(occ.masterId, occ.occurrenceDate);
    else if (confirmAction.type === "delete") await deleteSeries(occ.masterId);
    setConfirmAction(null);
    load();
  }

  function startEdit(occ: ScheduleOccurrence) {
    setOpenMenuKey(null);
    if (occ.isRecurring) setScopeChoice(occ);
    else {
      setEditScope("series");
      setEditing(occ);
    }
  }

  async function openHistory(occ: ScheduleOccurrence) {
    setOpenMenuKey(null);
    setHistoryFor(occ);
    const { data } = await getCompletionHistory(occ.masterId);
    setHistory(data || []);
  }

  const grouped = new Map<string, ScheduleOccurrence[]>();
  (occurrences || []).forEach((occ) => {
    const day = occ.occurrenceDate;
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day)!.push(occ);
  });

  return (
    <div>
      <SectionHead
        title={t("schedulePage.title")}
        subtitle={t("schedulePage.upcoming60Days")}
        action={
          <Btn variant="gold" onClick={() => setCreating(true)}>
            ＋ {t("schedulePage.newEvent")}
          </Btn>
        }
      />

      {occurrences === null && (
        <Card>
          <EmptyState label={t("common.loading")} />
        </Card>
      )}
      {occurrences !== null && occurrences.length === 0 && (
        <Card>
          <EmptyState label={t("schedulePage.noEvents")} />
        </Card>
      )}

      {[...grouped.entries()].map(([day, dayOccurrences]) => (
        <div key={day} className="mb-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{formatDate(day, locale)}</div>
          <Card>
            {dayOccurrences.map((occ) => (
              <div key={occ.key} className="border-b border-line py-3 last:border-0">
                {confirmAction?.key === occ.key ? (
                  <ConfirmBar
                    message={confirmAction.type === "skip" ? t("schedulePage.confirmSkip") : t("schedulePage.confirmDeleteSeries")}
                    onConfirm={runConfirmedAction}
                    onCancel={() => setConfirmAction(null)}
                  />
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <label className="mt-1 flex items-center">
                      <input
                        type="checkbox"
                        checked={occ.status === "done"}
                        onChange={() => toggleComplete(occ)}
                        className="h-5 w-5 accent-gold"
                      />
                    </label>
                    <button className="flex-1 text-left" onClick={() => startEdit(occ)}>
                      <div className="flex items-center gap-2">
                        <b className={`block text-sm ${occ.status === "done" ? "text-muted line-through" : ""}`}>{occ.title}</b>
                        {occ.isRecurring && (
                          <span className="rounded-full bg-panel2 px-2 py-0.5 text-[9px] uppercase text-muted">
                            {t("schedulePage.recurringBadge")}
                          </span>
                        )}
                      </div>
                      <small className="text-muted">
                        {formatDateTime(occ.start_time, locale)}
                        {occ.location ? ` · ${occ.location}` : ""}
                      </small>
                    </button>
                    <button
                      onClick={() => setOpenMenuKey(openMenuKey === occ.key ? null : occ.key)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-muted"
                    >
                      ⋯
                    </button>
                  </div>
                )}
                {openMenuKey === occ.key && confirmAction?.key !== occ.key && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Btn onClick={() => startEdit(occ)}>{t("common.edit")}</Btn>
                    {occ.isRecurring && (
                      <Btn onClick={() => setConfirmAction({ key: occ.key, type: "skip" })}>{t("schedulePage.skipOccurrence")}</Btn>
                    )}
                    {occ.isRecurring && <Btn onClick={() => openHistory(occ)}>{t("schedulePage.completionHistory")}</Btn>}
                    <Btn variant="danger" onClick={() => setConfirmAction({ key: occ.key, type: "delete" })}>
                      {t("schedulePage.deleteSeries")}
                    </Btn>
                  </div>
                )}
              </div>
            ))}
          </Card>
        </div>
      ))}

      <Sheet open={creating} onClose={() => setCreating(false)} title={t("schedulePage.newEvent")}>
        <ScheduleEventForm
          onCancel={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      </Sheet>

      <Sheet open={scopeChoice !== null} onClose={() => setScopeChoice(null)} title={t("schedulePage.editScopeTitle")}>
        {scopeChoice && (
          <div className="space-y-2">
            <button
              className="w-full rounded-xl border border-line bg-bg p-3 text-left text-sm"
              onClick={() => {
                setEditScope("this");
                setEditing(scopeChoice);
                setScopeChoice(null);
              }}
            >
              {t("schedulePage.editScopeThisOnly")}
            </button>
            <button
              className="w-full rounded-xl border border-line bg-bg p-3 text-left text-sm"
              onClick={() => {
                setEditScope("future");
                setEditing(scopeChoice);
                setScopeChoice(null);
              }}
            >
              {t("schedulePage.editScopeThisAndFuture")}
            </button>
            <button
              className="w-full rounded-xl border border-line bg-bg p-3 text-left text-sm"
              onClick={() => {
                setEditScope("series");
                setEditing(scopeChoice);
                setScopeChoice(null);
              }}
            >
              {t("schedulePage.editScopeAll")}
            </button>
          </div>
        )}
      </Sheet>

      <Sheet
        open={editing !== null && editScope === "this"}
        onClose={() => {
          setEditing(null);
          setEditScope(null);
        }}
        title={t("schedulePage.editEvent")}
      >
        {editing && (
          <ScheduleOccurrenceForm
            occurrence={editing}
            onCancel={() => {
              setEditing(null);
              setEditScope(null);
            }}
            onSaved={() => {
              setEditing(null);
              setEditScope(null);
              load();
            }}
          />
        )}
      </Sheet>

      <Sheet
        open={editing !== null && (editScope === "future" || editScope === "series")}
        onClose={() => {
          setEditing(null);
          setEditScope(null);
        }}
        title={t("schedulePage.editEvent")}
      >
        {editing && (
          <ScheduleEventForm
            existing={findMaster(editing.masterId)}
            splitFromDate={editScope === "future" ? editing.occurrenceDate : undefined}
            onCancel={() => {
              setEditing(null);
              setEditScope(null);
            }}
            onSaved={() => {
              setEditing(null);
              setEditScope(null);
              load();
            }}
          />
        )}
      </Sheet>

      <Sheet open={historyFor !== null} onClose={() => setHistoryFor(null)} title={t("schedulePage.completionHistory")}>
        {history === null && <EmptyState label={t("common.loading")} />}
        {history !== null && history.length === 0 && <EmptyState label={t("schedulePage.noCompletions")} />}
        {history?.map((h) => (
          <div key={h.occurrence_date} className="border-b border-line py-2 text-sm last:border-0">
            {formatDate(h.occurrence_date, locale)}
          </div>
        ))}
      </Sheet>
    </div>
  );
}
