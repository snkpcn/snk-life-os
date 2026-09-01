"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FieldDef, ResourceDef } from "@/lib/resources";
import { Btn } from "@/components/ui";
import { toDateInputValue, toDateTimeInputValue } from "@/lib/format";

type RelationOption = { value: string; label: string };

function useRelationOptions(fields: FieldDef[]) {
  const [options, setOptions] = useState<Record<string, RelationOption[]>>({});

  useEffect(() => {
    const relFields = fields.filter((f) => f.type === "relation" && f.relationTable);
    if (relFields.length === 0) return;
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const entries = await Promise.all(
        relFields.map(async (f) => {
          const labelKey = f.relationLabelKey || "name";
          const { data } = await supabase
            .from(f.relationTable as any)
            .select(`id, ${labelKey}`)
            .order(labelKey, { ascending: true })
            .limit(500);
          const opts = (data || []).map((row: any) => ({
            value: String(row.id),
            label: String(row[labelKey] ?? row.id),
          }));
          return [f.key, opts] as const;
        })
      );
      if (!cancelled) setOptions(Object.fromEntries(entries));
    })();

    return () => {
      cancelled = true;
    };
  }, [fields]);

  return options;
}

function fieldInitialValue(field: FieldDef, existing: Record<string, unknown> | null) {
  if (existing && field.key in existing) {
    const v = existing[field.key];
    if (field.type === "date") return toDateInputValue(v as string);
    if (field.type === "datetime") return toDateTimeInputValue(v as string);
    if (field.type === "tags") return Array.isArray(v) ? (v as string[]).join(", ") : "";
    if (field.type === "boolean") return Boolean(v);
    return v ?? "";
  }
  if (field.default !== undefined) return field.default;
  if (field.type === "boolean") return false;
  return "";
}

export function ResourceForm({
  resource,
  existing,
  onCancel,
  onSaved,
}: {
  resource: ResourceDef;
  existing?: Record<string, unknown> | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const relationOptions = useRelationOptions(resource.fields);
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    resource.fields.forEach((f) => {
      init[f.key] = fieldInitialValue(f, existing ?? null);
    });
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setValue(key: string, v: unknown) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();

    const payload: Record<string, unknown> = {};
    resource.fields.forEach((f) => {
      let v = values[f.key];
      if (f.type === "tags") {
        v = String(v || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (f.type === "number" || f.type === "money") {
        v = v === "" || v === null || v === undefined ? null : Number(v);
      }
      if (f.type === "relation") {
        v = v === "" ? null : v;
      }
      if ((f.type === "date" || f.type === "datetime") && v === "") {
        v = null;
      }
      if (f.type === "datetime" && typeof v === "string" && v) {
        v = new Date(v).toISOString();
      }
      payload[f.key] = v;
    });

    const query = existing
      ? supabase.from(resource.table as any).update(payload).eq("id", existing.id as string)
      : supabase.from(resource.table as any).insert(payload);

    const { error } = await query;
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {resource.fields.map((f) => (
        <FieldInput
          key={f.key}
          field={f}
          value={values[f.key]}
          onChange={(v) => setValue(f.key, v)}
          options={f.type === "relation" ? relationOptions[f.key] : f.options}
        />
      ))}

      {error && <div className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</div>}

      <div className="grid grid-cols-2 gap-2 pt-2">
        <Btn variant="ghost" onClick={onCancel} className="border border-line">
          Cancel
        </Btn>
        <Btn variant="gold" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Btn>
      </div>
    </form>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  options,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  options?: { value: string; label: string }[];
}) {
  const base =
    "w-full rounded-xl border border-line bg-bg px-3 py-3 text-ink outline-none focus:border-gold min-h-[46px]";

  if (field.type === "boolean") {
    return (
      <label className="flex items-center justify-between rounded-xl border border-line bg-bg px-3 py-3">
        <span className="text-sm text-muted">{field.label}</span>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-5 w-5 accent-gold"
        />
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        <label className="mb-1 block text-[11px] text-muted">{field.label}</label>
        <textarea
          required={field.required}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`${base} min-h-[100px]`}
          placeholder={field.placeholder}
        />
      </div>
    );
  }

  if (field.type === "select" || field.type === "relation") {
    return (
      <div>
        <label className="mb-1 block text-[11px] text-muted">{field.label}</label>
        <select
          required={field.required}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        >
          <option value="">{field.type === "relation" ? "None" : "Select…"}</option>
          {(options || []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const inputType =
    field.type === "number" || field.type === "money"
      ? "number"
      : field.type === "date"
        ? "date"
        : field.type === "datetime"
          ? "datetime-local"
          : "text";

  return (
    <div>
      <label className="mb-1 block text-[11px] text-muted">{field.label}</label>
      <input
        required={field.required}
        type={inputType}
        step={field.type === "money" ? "0.01" : undefined}
        value={(value as string | number) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={base}
      />
    </div>
  );
}
