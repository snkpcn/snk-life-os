"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, EmptyState, SectionHead } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";
import { translateOption } from "@/lib/i18n";

type Item = { id: string; title: string; when: string; kind: "task" | "event"; meta: string };

export default function TimelinePage() {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: tasks }, { data: events }] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, due_date, status, priority")
          .is("archived_at", null)
          .not("due_date", "is", null)
          .order("due_date", { ascending: true })
          .limit(50),
        supabase
          .from("schedule_events")
          .select("id, title, start_time, status, category")
          .is("archived_at", null)
          .order("start_time", { ascending: true })
          .limit(50),
      ]);

      const merged: Item[] = [
        ...(tasks || []).map((task) => ({
          id: `t-${task.id}`,
          title: task.title,
          when: task.due_date as string,
          kind: "task" as const,
          meta: `${t("timelinePage.taskLabel")} · ${translateOption(locale, task.status || "", task.status || "")}`,
        })),
        ...(events || []).map((event) => ({
          id: `e-${event.id}`,
          title: event.title,
          when: event.start_time,
          kind: "event" as const,
          meta: `${t("timelinePage.eventLabel")} · ${translateOption(locale, event.category || event.status || "", event.category || event.status || "")}`,
        })),
      ].sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime());

      setItems(merged);
    })();
  }, [t, locale]);

  return (
    <div>
      <SectionHead title={t("timelinePage.title")} subtitle={t("timelinePage.subtitle")} />
      <Card>
        {items.length === 0 && <EmptyState label={t("timelinePage.empty")} />}
        {items.map((i) => (
          <div key={i.id} className="flex items-center justify-between border-b border-line py-3 last:border-0">
            <div>
              <b className="block text-sm">{i.title}</b>
              <small className="text-muted">{formatDateTime(i.when, locale)}</small>
            </div>
            <span className="rounded-full bg-panel2 px-2 py-1 text-[10px] uppercase text-muted">{i.meta}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
