import { createClient } from "@/lib/supabase/client";

export const BACKUP_TABLES = [
  "profiles",
  "businesses",
  "projects",
  "goals",
  "goal_projects",
  "milestones",
  "tasks",
  "schedule_events",
  "transactions",
  "budgets",
  "assets",
  "asset_valuations",
  "debts",
  "recurring_transactions",
  "financial_accounts",
  "transaction_categories",
  "holdings",
  "watchlists",
  "watchlist_items",
  "price_alerts",
  "kpis",
  "kpi_entries",
  "reviews",
  "notes",
  "top_priorities",
  "decisions",
  "user_settings",
  "wishlist_categories",
  "wishlist_items",
  "savings_goals",
  "savings_contributions",
  "wishlist_price_history",
] as const;

export async function exportAllData() {
  const supabase = createClient();
  const result: Record<string, unknown[]> = {};
  for (const table of BACKUP_TABLES) {
    const { data } = await supabase.from(table as any).select("*");
    result[table] = data || [];
  }
  return { schema_version: 1, exported_at: new Date().toISOString(), tables: result };
}

export async function saveSnapshot(reason: string) {
  const supabase = createClient();
  const payload = await exportAllData();
  await supabase.from("backup_snapshots").insert({ schema_version: "1", reason, data: payload as any, verified: true });
  return payload;
}

const STRIP_KEYS = new Set(["id", "created_at", "updated_at", "owner_id"]);

export async function restoreFromExport(payload: { tables: Record<string, unknown[]> }) {
  const supabase = createClient();
  let inserted = 0;
  const errors: string[] = [];
  for (const table of BACKUP_TABLES) {
    const rows = payload.tables?.[table];
    if (!rows || rows.length === 0) continue;
    const cleaned = rows.map((row) => {
      const r = { ...(row as Record<string, unknown>) };
      STRIP_KEYS.forEach((k) => delete r[k]);
      return r;
    });
    const { error, count } = await supabase.from(table as any).insert(cleaned, { count: "exact" });
    if (error) errors.push(`${table}: ${error.message}`);
    else inserted += count || cleaned.length;
  }
  return { inserted, errors };
}

type LegacyShape = {
  metrics?: { id: string; name: string; current: number | null; target: number; unit: string }[];
  projects?: {
    name: string;
    phase: string;
    status: string;
    priority: number;
    goal: string;
    milestone: string;
    action: string;
    blocker: string;
  }[];
};

export async function importLegacyData(payload: LegacyShape) {
  const supabase = createClient();
  let imported = 0;
  const errors: string[] = [];

  for (const m of payload.metrics || []) {
    const { error } = await supabase.from("goals").insert({
      title: m.name,
      level: "quarterly",
      target_value: m.target,
      current_value: m.current,
      unit: m.unit,
      status: "active",
    });
    if (error) errors.push(`goal ${m.name}: ${error.message}`);
    else imported++;
  }

  for (const p of payload.projects || []) {
    const { error } = await supabase.from("projects").insert({
      name: p.name,
      category: p.phase,
      status: p.status,
      priority: String(p.priority || 2),
      description: p.goal,
      next_milestone: p.milestone,
      next_action: p.action,
      blocker: p.blocker,
    });
    if (error) errors.push(`project ${p.name}: ${error.message}`);
    else imported++;
  }

  return { imported, errors };
}

export function detectPayloadKind(json: unknown): "backup" | "legacy" | "unknown" {
  if (json && typeof json === "object") {
    if ("tables" in (json as any)) return "backup";
    if ("metrics" in (json as any) || "projects" in (json as any)) return "legacy";
  }
  return "unknown";
}
