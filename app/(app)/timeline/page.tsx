import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, SectionHead } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const supabase = createClient();
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

  type Item = { id: string; title: string; when: string; kind: "task" | "event"; meta: string };
  const items: Item[] = [
    ...(tasks || []).map((t) => ({
      id: `t-${t.id}`,
      title: t.title,
      when: t.due_date as string,
      kind: "task" as const,
      meta: `Task · ${t.status}`,
    })),
    ...(events || []).map((e) => ({
      id: `e-${e.id}`,
      title: e.title,
      when: e.start_time,
      kind: "event" as const,
      meta: `Event · ${e.category || e.status}`,
    })),
  ].sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime());

  return (
    <div>
      <SectionHead title="Timeline" subtitle="Tasks and schedule, merged chronologically" />
      <Card>
        {items.length === 0 && <EmptyState label="Nothing scheduled or due yet." />}
        {items.map((i) => (
          <div key={i.id} className="flex items-center justify-between border-b border-line py-3 last:border-0">
            <div>
              <b className="block text-sm">{i.title}</b>
              <small className="text-muted">{formatDateTime(i.when)}</small>
            </div>
            <span className="rounded-full bg-panel2 px-2 py-1 text-[10px] uppercase text-muted">{i.meta}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
