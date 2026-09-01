export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
          owner_id: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type: string
          id?: number
          metadata?: Json
          owner_id?: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: number
          metadata?: Json
          owner_id?: string
        }
        Relationships: []
      }
      ai_context: {
        Row: {
          content: Json
          context_key: string
          created_at: string
          id: string
          owner_id: string
          source_id: string | null
          source_type: string | null
          updated_at: string
        }
        Insert: {
          content?: Json
          context_key: string
          created_at?: string
          id?: string
          owner_id?: string
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
        }
        Update: {
          content?: Json
          context_key?: string
          created_at?: string
          id?: string
          owner_id?: string
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_summaries: {
        Row: {
          content: Json
          created_at: string
          id: string
          owner_id: string
          period_end: string | null
          period_start: string | null
          source_updated_at: string | null
          summary_type: string
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          owner_id?: string
          period_end?: string | null
          period_start?: string | null
          source_updated_at?: string | null
          summary_type: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          owner_id?: string
          period_end?: string | null
          period_start?: string | null
          source_updated_at?: string | null
          summary_type?: string
        }
        Relationships: []
      }
      asset_valuations: {
        Row: {
          asset_id: string
          created_at: string
          currency: string
          id: string
          notes: string | null
          owner_id: string
          value: number
          valued_on: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          owner_id?: string
          value: number
          valued_on?: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          owner_id?: string
          value?: number
          valued_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_valuations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          archived_at: string | null
          created_at: string
          currency: string
          id: string
          name: string
          notes: string | null
          owner_id: string
          type: string | null
          updated_at: string
          valuation_date: string | null
          value: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          name: string
          notes?: string | null
          owner_id?: string
          type?: string | null
          updated_at?: string
          valuation_date?: string | null
          value: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          type?: string | null
          updated_at?: string
          valuation_date?: string | null
          value?: number
        }
        Relationships: []
      }
      backup_snapshots: {
        Row: {
          created_at: string
          data: Json
          id: string
          owner_id: string
          reason: string
          schema_version: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          owner_id?: string
          reason?: string
          schema_version: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          owner_id?: string
          reason?: string
          schema_version?: string
          verified?: boolean
        }
        Relationships: []
      }
      budgets: {
        Row: {
          archived_at: string | null
          category: string
          created_at: string
          currency: string
          id: string
          monthly_limit: number
          notes: string | null
          owner_id: string
          period_month: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          category: string
          created_at?: string
          currency?: string
          id?: string
          monthly_limit: number
          notes?: string | null
          owner_id?: string
          period_month?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          category?: string
          created_at?: string
          currency?: string
          id?: string
          monthly_limit?: number
          notes?: string | null
          owner_id?: string
          period_month?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      businesses: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          focus: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          status: string
          type: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          focus?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id?: string
          status?: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          focus?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          status?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      debts: {
        Row: {
          archived_at: string | null
          balance: number
          created_at: string
          currency: string
          due_day: number | null
          id: string
          interest_rate: number | null
          lender: string | null
          minimum_payment: number | null
          name: string
          notes: string | null
          owner_id: string
          type: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          balance: number
          created_at?: string
          currency?: string
          due_day?: number | null
          id?: string
          interest_rate?: number | null
          lender?: string | null
          minimum_payment?: number | null
          name: string
          notes?: string | null
          owner_id?: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          balance?: number
          created_at?: string
          currency?: string
          due_day?: number | null
          id?: string
          interest_rate?: number | null
          lender?: string | null
          minimum_payment?: number | null
          name?: string
          notes?: string | null
          owner_id?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      decisions: {
        Row: {
          archived_at: string | null
          business_id: string | null
          context: string | null
          created_at: string
          decided_on: string
          decision: string
          id: string
          outcome: string | null
          owner_id: string
          project_id: string | null
          reason: string | null
          review_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          business_id?: string | null
          context?: string | null
          created_at?: string
          decided_on?: string
          decision: string
          id?: string
          outcome?: string | null
          owner_id?: string
          project_id?: string | null
          reason?: string | null
          review_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          business_id?: string | null
          context?: string | null
          created_at?: string
          decided_on?: string
          decision?: string
          id?: string
          outcome?: string | null
          owner_id?: string
          project_id?: string | null
          reason?: string | null
          review_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          account_type: string
          archived_at: string | null
          created_at: string
          currency: string
          id: string
          institution: string | null
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number
          owner_id: string
          updated_at: string
        }
        Insert: {
          account_type?: string
          archived_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          institution?: string | null
          is_active?: boolean
          name: string
          notes?: string | null
          opening_balance?: number
          owner_id?: string
          updated_at?: string
        }
        Update: {
          account_type?: string
          archived_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          institution?: string | null
          is_active?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      goal_projects: {
        Row: {
          goal_id: string
          project_id: string
        }
        Insert: {
          goal_id: string
          project_id: string
        }
        Update: {
          goal_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_projects_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          archived_at: string | null
          created_at: string
          current_value: number | null
          deadline: string | null
          description: string | null
          domain: string | null
          id: string
          level: string
          notes: string | null
          owner_id: string
          parent_goal_id: string | null
          priority: string | null
          status: string | null
          target_value: number | null
          title: string
          tracking_configured: boolean
          tracking_method: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          domain?: string | null
          id?: string
          level: string
          notes?: string | null
          owner_id?: string
          parent_goal_id?: string | null
          priority?: string | null
          status?: string | null
          target_value?: number | null
          title: string
          tracking_configured?: boolean
          tracking_method?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          domain?: string | null
          id?: string
          level?: string
          notes?: string | null
          owner_id?: string
          parent_goal_id?: string | null
          priority?: string | null
          status?: string | null
          target_value?: number | null
          title?: string
          tracking_configured?: boolean
          tracking_method?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_parent_goal_id_fkey"
            columns: ["parent_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      holdings: {
        Row: {
          archived_at: string | null
          asset_class: string | null
          avg_cost: number | null
          broker: string | null
          created_at: string
          currency: string
          id: string
          market: string
          name: string | null
          notes: string | null
          owner_id: string
          quantity: number
          ticker: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          asset_class?: string | null
          avg_cost?: number | null
          broker?: string | null
          created_at?: string
          currency?: string
          id?: string
          market?: string
          name?: string | null
          notes?: string | null
          owner_id?: string
          quantity?: number
          ticker: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          asset_class?: string | null
          avg_cost?: number | null
          broker?: string | null
          created_at?: string
          currency?: string
          id?: string
          market?: string
          name?: string | null
          notes?: string | null
          owner_id?: string
          quantity?: number
          ticker?: string
          updated_at?: string
        }
        Relationships: []
      }
      kpi_entries: {
        Row: {
          created_at: string
          id: string
          kpi_id: string
          notes: string | null
          owner_id: string
          period_end: string | null
          period_start: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          kpi_id: string
          notes?: string | null
          owner_id?: string
          period_end?: string | null
          period_start: string
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          kpi_id?: string
          notes?: string | null
          owner_id?: string
          period_end?: string | null
          period_start?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_entries_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      kpis: {
        Row: {
          archived_at: string | null
          business_id: string | null
          created_at: string
          current_value: number | null
          frequency: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          period: string | null
          project_id: string | null
          target_value: number | null
          tracking_configured: boolean
          unit: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          business_id?: string | null
          created_at?: string
          current_value?: number | null
          frequency?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id?: string
          period?: string | null
          project_id?: string | null
          target_value?: number | null
          tracking_configured?: boolean
          unit?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          business_id?: string | null
          created_at?: string
          current_value?: number | null
          frequency?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          period?: string | null
          project_id?: string | null
          target_value?: number | null
          tracking_configured?: boolean
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpis_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          owner_id: string
          position: number | null
          project_id: string
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string
          position?: number | null
          project_id: string
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string
          position?: number | null
          project_id?: string
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          archived_at: string | null
          business_id: string | null
          content: string | null
          created_at: string
          goal_id: string | null
          id: string
          owner_id: string
          project_id: string | null
          related_id: string | null
          related_type: string | null
          tags: string[]
          title: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          business_id?: string | null
          content?: string | null
          created_at?: string
          goal_id?: string | null
          id?: string
          owner_id?: string
          project_id?: string | null
          related_id?: string | null
          related_type?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          business_id?: string | null
          content?: string | null
          created_at?: string
          goal_id?: string | null
          id?: string
          owner_id?: string
          project_id?: string | null
          related_id?: string | null
          related_type?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      price_alerts: {
        Row: {
          condition_type: string
          created_at: string
          currency: string | null
          id: string
          is_active: boolean
          last_observed_value: number | null
          market: string | null
          notes: string | null
          owner_id: string
          symbol: string
          target_value: number
          triggered_at: string | null
          updated_at: string
        }
        Insert: {
          condition_type: string
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean
          last_observed_value?: number | null
          market?: string | null
          notes?: string | null
          owner_id?: string
          symbol: string
          target_value: number
          triggered_at?: string | null
          updated_at?: string
        }
        Update: {
          condition_type?: string
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean
          last_observed_value?: number | null
          market?: string | null
          notes?: string | null
          owner_id?: string
          symbol?: string
          target_value?: number
          triggered_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          currency: string
          display_name: string | null
          id: string
          notes: string | null
          start_of_week: string
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          currency?: string
          display_name?: string | null
          id: string
          notes?: string | null
          start_of_week?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          currency?: string
          display_name?: string | null
          id?: string
          notes?: string | null
          start_of_week?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          archived_at: string | null
          blocker: string | null
          budget: number | null
          business_id: string | null
          category: string
          created_at: string
          description: string | null
          due_date: string | null
          explicit_progress: number | null
          goal_id: string | null
          id: string
          name: string
          next_action: string | null
          next_milestone: string | null
          notes: string | null
          owner_id: string
          priority: string | null
          progress_mode: string | null
          project_type: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          blocker?: string | null
          budget?: number | null
          business_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          explicit_progress?: number | null
          goal_id?: string | null
          id?: string
          name: string
          next_action?: string | null
          next_milestone?: string | null
          notes?: string | null
          owner_id?: string
          priority?: string | null
          progress_mode?: string | null
          project_type?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          blocker?: string | null
          budget?: number | null
          business_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          explicit_progress?: number | null
          goal_id?: string | null
          id?: string
          name?: string
          next_action?: string | null
          next_milestone?: string | null
          notes?: string | null
          owner_id?: string
          priority?: string | null
          progress_mode?: string | null
          project_type?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_transactions: {
        Row: {
          account_id: string | null
          amount: number
          archived_at: string | null
          business_id: string | null
          category_id: string | null
          created_at: string
          currency: string
          due_day: number | null
          frequency: string
          id: string
          is_active: boolean
          next_occurrence: string | null
          notes: string | null
          owner_id: string
          project_id: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          archived_at?: string | null
          business_id?: string | null
          category_id?: string | null
          created_at?: string
          currency?: string
          due_day?: number | null
          frequency: string
          id?: string
          is_active?: boolean
          next_occurrence?: string | null
          notes?: string | null
          owner_id?: string
          project_id?: string | null
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          archived_at?: string | null
          business_id?: string | null
          category_id?: string | null
          created_at?: string
          currency?: string
          due_day?: number | null
          frequency?: string
          id?: string
          is_active?: boolean
          next_occurrence?: string | null
          notes?: string | null
          owner_id?: string
          project_id?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          content: Json
          created_at: string
          id: string
          owner_id: string
          period_end: string
          period_start: string
          type: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          owner_id?: string
          period_end: string
          period_start: string
          type: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          owner_id?: string
          period_end?: string
          period_start?: string
          type?: string
        }
        Relationships: []
      }
      savings_contributions: {
        Row: {
          account_id: string | null
          amount: number
          contributed_on: string
          corrects_entry_id: string | null
          created_at: string
          entry_type: string
          id: string
          note: string | null
          owner_id: string
          savings_goal_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          contributed_on?: string
          corrects_entry_id?: string | null
          created_at?: string
          entry_type?: string
          id?: string
          note?: string | null
          owner_id?: string
          savings_goal_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          contributed_on?: string
          corrects_entry_id?: string | null
          created_at?: string
          entry_type?: string
          id?: string
          note?: string | null
          owner_id?: string
          savings_goal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_contributions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_contributions_corrects_entry_id_fkey"
            columns: ["corrects_entry_id"]
            isOneToOne: false
            referencedRelation: "savings_contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_contributions_savings_goal_id_fkey"
            columns: ["savings_goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          account_id: string | null
          archived_at: string | null
          created_at: string
          currency: string
          id: string
          name: string
          notes: string | null
          owner_id: string
          priority: string
          status: string
          target_amount: number
          target_date: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          archived_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          name: string
          notes?: string | null
          owner_id?: string
          priority?: string
          status?: string
          target_amount: number
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          archived_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          priority?: string
          status?: string
          target_amount?: number
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_events: {
        Row: {
          all_day: boolean
          archived_at: string | null
          business_id: string | null
          category: string
          created_at: string
          end_time: string | null
          id: string
          location: string | null
          notes: string | null
          owner_id: string
          priority: string | null
          project_id: string | null
          reminder_at: string | null
          start_time: string
          status: string
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          archived_at?: string | null
          business_id?: string | null
          category?: string
          created_at?: string
          end_time?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          owner_id?: string
          priority?: string | null
          project_id?: string | null
          reminder_at?: string | null
          start_time: string
          status?: string
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          archived_at?: string | null
          business_id?: string | null
          category?: string
          created_at?: string
          end_time?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          owner_id?: string
          priority?: string | null
          project_id?: string | null
          reminder_at?: string | null
          start_time?: string
          status?: string
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          archived_at: string | null
          business_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          due_time: string | null
          goal_id: string | null
          id: string
          is_today_priority: boolean
          notes: string | null
          owner_id: string
          position: number | null
          priority: string | null
          priority_rank: number | null
          project_id: string | null
          status: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          business_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          goal_id?: string | null
          id?: string
          is_today_priority?: boolean
          notes?: string | null
          owner_id?: string
          position?: number | null
          priority?: string | null
          priority_rank?: number | null
          project_id?: string | null
          status?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          business_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          goal_id?: string | null
          id?: string
          is_today_priority?: boolean
          notes?: string | null
          owner_id?: string
          position?: number | null
          priority?: string | null
          priority_rank?: number | null
          project_id?: string | null
          status?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      top_priorities: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: string
          owner_id: string
          position: number
          priority_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          owner_id?: string
          position: number
          priority_date?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          owner_id?: string
          position?: number
          priority_date?: string
        }
        Relationships: []
      }
      transaction_categories: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          owner_id: string
          position: number
          transaction_type: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          owner_id?: string
          position?: number
          transaction_type?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          owner_id?: string
          position?: number
          transaction_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          archived_at: string | null
          business_id: string | null
          category: string | null
          category_id: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          merchant: string | null
          notes: string | null
          occurred_at: string
          owner_id: string
          project_id: string | null
          transfer_account_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          archived_at?: string | null
          business_id?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          merchant?: string | null
          notes?: string | null
          occurred_at?: string
          owner_id?: string
          project_id?: string | null
          transfer_account_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          archived_at?: string | null
          business_id?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          merchant?: string | null
          notes?: string | null
          occurred_at?: string
          owner_id?: string
          project_id?: string | null
          transfer_account_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_transfer_account_id_fkey"
            columns: ["transfer_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          owner_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          owner_id?: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          owner_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      watchlist_items: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          market: string
          name: string | null
          note: string | null
          owner_id: string
          position: number | null
          ticker: string
          watchlist_id: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          market?: string
          name?: string | null
          note?: string | null
          owner_id?: string
          position?: number | null
          ticker: string
          watchlist_id?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          market?: string
          name?: string | null
          note?: string | null
          owner_id?: string
          position?: number | null
          ticker?: string
          watchlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_items_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlists: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          position: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          position?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      wishlist_categories: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          position: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          position?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          archived_at: string | null
          category_id: string | null
          created_at: string
          currency: string
          current_estimated_price: number | null
          description: string | null
          desired_date: string | null
          id: string
          image_url: string | null
          merchant: string | null
          name: string
          notes: string | null
          owner_id: string
          position: number
          priority: string
          product_url: string | null
          purchased_at: string | null
          purchased_transaction_id: string | null
          savings_goal_id: string | null
          status: string
          target_price: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          category_id?: string | null
          created_at?: string
          currency?: string
          current_estimated_price?: number | null
          description?: string | null
          desired_date?: string | null
          id?: string
          image_url?: string | null
          merchant?: string | null
          name: string
          notes?: string | null
          owner_id?: string
          position?: number
          priority?: string
          product_url?: string | null
          purchased_at?: string | null
          purchased_transaction_id?: string | null
          savings_goal_id?: string | null
          status?: string
          target_price: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          category_id?: string | null
          created_at?: string
          currency?: string
          current_estimated_price?: number | null
          description?: string | null
          desired_date?: string | null
          id?: string
          image_url?: string | null
          merchant?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          position?: number
          priority?: string
          product_url?: string | null
          purchased_at?: string | null
          purchased_transaction_id?: string | null
          savings_goal_id?: string | null
          status?: string
          target_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "wishlist_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_purchased_transaction_id_fkey"
            columns: ["purchased_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_savings_goal_id_fkey"
            columns: ["savings_goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_price_history: {
        Row: {
          created_at: string
          currency: string
          id: string
          merchant: string | null
          notes: string | null
          observed_at: string
          owner_id: string
          price: number
          source: string | null
          wishlist_item_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          merchant?: string | null
          notes?: string | null
          observed_at?: string
          owner_id?: string
          price: number
          source?: string | null
          wishlist_item_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          merchant?: string | null
          notes?: string | null
          observed_at?: string
          owner_id?: string
          price?: number
          source?: string | null
          wishlist_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_price_history_wishlist_item_id_fkey"
            columns: ["wishlist_item_id"]
            isOneToOne: false
            referencedRelation: "wishlist_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
