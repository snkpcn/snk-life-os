"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SectionHead, Card, EmptyState } from "@/components/ui";
import { TodayPriorities } from "@/components/today-priorities";
import { ResourceSection } from "@/components/resource-section";
import { RESOURCES } from "@/lib/resources";
import { formatDate } from "@/lib/format";

type Task = { id: string; title: string; status: string | null; priority: string | null; due_date: string | null };

export default function TasksPage() {
  const [topTasks, setTopTasks] = useState<Task[]>([]);
  const [overdue, setOverdue] = useState<Task[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    const supabase = createClient();
    const todayStr = new Date().toISOString().slice(0, 10);
    const [{ data: top }, { data: due }] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, status, priority, due_date")
        .eq("is_today_priority", true)
        .is("archived_at", null)
        .order("priority_rank", { ascending: true }),
      supabase
        .from("tasks")
        .select("id, title, status, priority, due_date")
        .is("archived_at", null)
        .neq("status", "done")
        .lt("due_date", todayStr)
        .order("due_date", { ascending: true }),
    ]);
    setTopTasks(top || []);
    setOverdue(due || []);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <div>
      <SectionHead title="Top 3 Today" />
      <TodayPriorities tasks={topTasks} />

      <SectionHead title="Needs Attention" subtitle="Overdue tasks" />
      <Card>
        {overdue.length === 0 && <EmptyState label="Nothing overdue. You're on top of it." />}
        {overdue.map((t) => (
          <div key={t.id} className="flex items-center justify-between border-b border-line py-3 last:border-0">
            <b className="text-sm">{t.title}</b>
            <span className="rounded-full bg-red/10 px-2 py-1 text-[10px] uppercase text-red">
              due {formatDate(t.due_date)}
            </span>
          </div>
        ))}
      </Card>

      <ResourceSection resource={RESOURCES.tasks} onChange={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}
