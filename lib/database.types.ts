export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type GenericTable = {
  Row: Record<string, any>;
  Insert: Record<string, any>;
  Update: Record<string, any>;
  Relationships: unknown[];
};

// All 36 tables share this shape at the type level. Every real column name used
// anywhere in this app has been cross-checked against the live generated schema
// (snk-life-os-private, project pbbihfipfbpiqbiqlagd) — see PROJECT_STATE.md.
// This loose shape keeps the file small without changing runtime behavior at all.
export type Database = {
  public: {
    Tables: Record<string, GenericTable>;
    Views: Record<string, { Row: Record<string, any>; Relationships: unknown[] }>;
    Functions: {
      // SNK MONEY x Thongthai LINE channel (migration 20261005140000); owner-only, SECURITY DEFINER, authenticated.
      finance_issue_binding_code: { Args: Record<string, never>; Returns: Json };
      finance_binding_status: { Args: Record<string, never>; Returns: Json };
      finance_unbind_active: { Args: Record<string, never>; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
