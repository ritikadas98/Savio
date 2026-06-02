export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          auth_user_id: string | null
          email: string | null
          full_name: string | null
          avatar: 'strategist' | 'adventurer' | 'builder'
          life_stage: 'student' | 'working_no_dependents' | 'supporting_dependents' | 'pre_retiree' | null
          city: string | null
          monthly_income_gross: number | null
          monthly_income_net: number | null
          anchor_day_of_month: number | null
          income_pattern: 'regular_salaried' | 'irregular_freelance' | 'mixed' | null
          primary_bank: string | null
          disclaimer_acknowledged_at: string | null
          // D.49 (Stream 0.5t) — user rule columns added by migration 0019
          safety_net: number
          impulse_wait_threshold: number
          impulse_wait_hours: number
          daily_sps_floor: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_user_id?: string | null
          email?: string | null
          full_name?: string | null
          avatar: 'strategist' | 'adventurer' | 'builder'
          life_stage?: 'student' | 'working_no_dependents' | 'supporting_dependents' | 'pre_retiree' | null
          city?: string | null
          monthly_income_gross?: number | null
          monthly_income_net?: number | null
          anchor_day_of_month?: number | null
          income_pattern?: 'regular_salaried' | 'irregular_freelance' | 'mixed' | null
          primary_bank?: string | null
          disclaimer_acknowledged_at?: string | null
          safety_net?: number
          impulse_wait_threshold?: number
          impulse_wait_hours?: number
          daily_sps_floor?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          auth_user_id?: string | null
          email?: string | null
          full_name?: string | null
          avatar?: 'strategist' | 'adventurer' | 'builder'
          life_stage?: 'student' | 'working_no_dependents' | 'supporting_dependents' | 'pre_retiree' | null
          city?: string | null
          monthly_income_gross?: number | null
          monthly_income_net?: number | null
          anchor_day_of_month?: number | null
          income_pattern?: 'regular_salaried' | 'irregular_freelance' | 'mixed' | null
          primary_bank?: string | null
          disclaimer_acknowledged_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      commitments: {
        Row: {
          id: string
          user_id: string | null
          label: string
          amount: number
          frequency: 'monthly' | 'quarterly' | 'annual' | 'irregular' | null
          category: string | null
          next_due_date: string | null
          source: 'detected_from_statement' | 'user_added' | 'manual' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          label: string
          amount: number
          frequency?: 'monthly' | 'quarterly' | 'annual' | 'irregular' | null
          category?: string | null
          next_due_date?: string | null
          source?: 'detected_from_statement' | 'user_added' | 'manual' | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          label?: string
          amount?: number
          frequency?: 'monthly' | 'quarterly' | 'annual' | 'irregular' | null
          category?: string | null
          next_due_date?: string | null
          source?: 'detected_from_statement' | 'user_added' | 'manual' | null
          created_at?: string
          updated_at?: string
        }
      }
      goals: {
        Row: {
          id: string
          user_id: string | null
          label: string
          target_amount: number
          current_amount: number | null
          target_date: string | null
          monthly_contribution: number | null
          status: 'active' | 'paused' | 'achieved' | 'abandoned' | null
          priority: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          label: string
          target_amount: number
          current_amount?: number | null
          target_date?: string | null
          monthly_contribution?: number | null
          status?: 'active' | 'paused' | 'achieved' | 'abandoned' | null
          priority?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          label?: string
          target_amount?: number
          current_amount?: number | null
          target_date?: string | null
          monthly_contribution?: number | null
          status?: 'active' | 'paused' | 'achieved' | 'abandoned' | null
          priority?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string | null
          occurred_at: string
          amount: number
          direction: 'credit' | 'debit'
          merchant: string | null
          description: string | null
          category: string | null
          category_source: 'auto_inferred' | 'user_labeled' | 'unknown' | null
          is_significant: boolean | null
          is_recurring: boolean | null
          commitment_id: string | null
          source: 'statement' | 'sms' | 'manual' | 'seeded_demo' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          occurred_at: string
          amount: number
          direction: 'credit' | 'debit'
          merchant?: string | null
          description?: string | null
          category?: string | null
          category_source?: 'auto_inferred' | 'user_labeled' | 'unknown' | null
          is_significant?: boolean | null
          is_recurring?: boolean | null
          commitment_id?: string | null
          source?: 'statement' | 'sms' | 'manual' | 'seeded_demo' | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          occurred_at?: string
          amount?: number
          direction?: 'credit' | 'debit'
          merchant?: string | null
          description?: string | null
          category?: string | null
          category_source?: 'auto_inferred' | 'user_labeled' | 'unknown' | null
          is_significant?: boolean | null
          is_recurring?: boolean | null
          commitment_id?: string | null
          source?: 'statement' | 'sms' | 'manual' | 'seeded_demo' | null
          created_at?: string
          updated_at?: string
        }
      }
      reflections: {
        Row: {
          id: string
          user_id: string | null
          transaction_id: string | null
          label: 'glad' | 'regret' | 'neutral'
          note: string | null
          reflected_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          transaction_id?: string | null
          label: 'glad' | 'regret' | 'neutral'
          note?: string | null
          reflected_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          transaction_id?: string | null
          label?: 'glad' | 'regret' | 'neutral'
          note?: string | null
          reflected_at?: string | null
        }
      }
      merchant_stats: {
        Row: {
          id: string
          user_id: string | null
          merchant: string
          total_transactions: number | null
          total_labeled: number | null
          glad_count: number | null
          regret_count: number | null
          neutral_count: number | null
          regret_rate: number | null
          last_computed_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          merchant: string
          total_transactions?: number | null
          total_labeled?: number | null
          glad_count?: number | null
          regret_count?: number | null
          neutral_count?: number | null
          regret_rate?: number | null
          last_computed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          merchant?: string
          total_transactions?: number | null
          total_labeled?: number | null
          glad_count?: number | null
          regret_count?: number | null
          neutral_count?: number | null
          regret_rate?: number | null
          last_computed_at?: string | null
        }
      }
      monthly_rituals: {
        Row: {
          id: string
          user_id: string | null
          month_year: string
          status: 'pending' | 'completed' | 'skipped' | 'carried_forward' | null
          income_confirmed: number | null
          commitments_confirmed: boolean | null
          focus_goal_id: string | null
          safe_to_spend_locked: number | null
          completed_at: string | null
          carried_forward_from: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          month_year: string
          status?: 'pending' | 'completed' | 'skipped' | 'carried_forward' | null
          income_confirmed?: number | null
          commitments_confirmed?: boolean | null
          focus_goal_id?: string | null
          safe_to_spend_locked?: number | null
          completed_at?: string | null
          carried_forward_from?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          month_year?: string
          status?: 'pending' | 'completed' | 'skipped' | 'carried_forward' | null
          income_confirmed?: number | null
          commitments_confirmed?: boolean | null
          focus_goal_id?: string | null
          safe_to_spend_locked?: number | null
          completed_at?: string | null
          carried_forward_from?: string | null
          created_at?: string
        }
      }
      windfalls: {
        Row: {
          id: string
          user_id: string | null
          transaction_id: string | null
          amount: number
          detected_at: string | null
          status: 'pending_allocation' | 'allocated' | 'dismissed' | null
          allocations: Json | null
          allocated_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          transaction_id?: string | null
          amount: number
          detected_at?: string | null
          status?: 'pending_allocation' | 'allocated' | 'dismissed' | null
          allocations?: Json | null
          allocated_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          transaction_id?: string | null
          amount?: number
          detected_at?: string | null
          status?: 'pending_allocation' | 'allocated' | 'dismissed' | null
          allocations?: Json | null
          allocated_at?: string | null
          created_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          user_id: string | null
          role: 'user' | 'assistant' | 'system'
          content: string
          ai_metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          role: 'user' | 'assistant' | 'system'
          content: string
          ai_metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          role?: 'user' | 'assistant' | 'system'
          content?: string
          ai_metadata?: Json | null
          created_at?: string
        }
      }
      saved_decisions: {
        Row: {
          id: string
          user_id: string | null
          decision_text: string
          verdict: 'green' | 'amber' | 'red' | null
          amount: number | null
          related_message_id: string | null
          decided_at: string | null
          outcome_label: 'glad' | 'regret' | 'neutral' | 'pending' | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          decision_text: string
          verdict?: 'green' | 'amber' | 'red' | null
          amount?: number | null
          related_message_id?: string | null
          decided_at?: string | null
          outcome_label?: 'glad' | 'regret' | 'neutral' | 'pending' | null
        }
        Update: {
          id?: string
          user_id?: string | null
          decision_text?: string
          verdict?: 'green' | 'amber' | 'red' | null
          amount?: number | null
          related_message_id?: string | null
          decided_at?: string | null
          outcome_label?: 'glad' | 'regret' | 'neutral' | 'pending' | null
        }
      }
      // D.62 + Phase 3 Doc 1.2 — rollover_allocations table (migrations 0008 + 0011).
      // Stores the split-rollover allocations created at monthly ritual lock-in:
      // each row is one slice of the prior month's leftover going to a destination
      // (a specific goal, the emergency fund, or carry-forward as next month's
      // free spend). source_breakdown is a JSONB blob capturing which buffer/
      // overrun lines contributed to this allocation; used by reset_april_ritual /
      // reset_to_canonical to reverse the destination-goal mutations cleanly.
      rollover_allocations: {
        Row: {
          id: string
          user_id: string
          ritual_month: string
          destination_kind: 'goal' | 'carry_forward' | 'emergency_fund'
          destination_goal_id: string | null
          total_amount: number
          source_breakdown: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          ritual_month: string
          destination_kind: 'goal' | 'carry_forward' | 'emergency_fund'
          destination_goal_id?: string | null
          total_amount: number
          source_breakdown?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          ritual_month?: string
          destination_kind?: 'goal' | 'carry_forward' | 'emergency_fund'
          destination_goal_id?: string | null
          total_amount?: number
          source_breakdown?: Json
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    // RPC signatures backing supabase.rpc() calls across the frontend.
    // Migrations 0009-0018 define these. Each entry: Args is the param
    // shape the RPC takes; Returns is its declared return type (often
    // jsonb / void). Keep in sync with the Postgres function signatures.
    Functions: {
      // 0009 — complete_monthly_ritual: marks a month closed, snapshots
      // close-out state, sets completed_at. Returns jsonb summary.
      complete_monthly_ritual: {
        Args: {
          p_month_year: string
          p_allocations: Json[]
        }
        Returns: Json
      }
      // 0013 — complete_monthly_setup: locks in M's safe_to_spend +
      // focus goal + confirmed income. Has the M-1-completed precondition
      // added in D.8 / Migration 0017.
      complete_monthly_setup: {
        Args: {
          p_month_year: string
          p_focus_goal_id: string | null
          p_safe_to_spend_locked: number
          p_confirmed_income: number
        }
        Returns: Json
      }
      // 0014 — record_windfall_allocations: writes the allocation JSONB
      // onto windfalls.allocations + flips status='allocated'. Hybrid
      // persistence per C.5-feat (no goal balance mutation).
      record_windfall_allocations: {
        Args: {
          p_event_id: string
          p_allocations: { bucket_kind: string; amount: number }[]
        }
        Returns: Json
      }
      // 0010 — reviewer console actions (anon-callable per D.15).
      reset_april_ritual: {
        Args: Record<string, never>
        Returns: Json
      }
      clear_chat_history: {
        Args: Record<string, never>
        Returns: Json
      }
      reset_reflections_to_seed: {
        Args: Record<string, never>
        Returns: Json
      }
      // 0015 — patterns cache invalidation (Stream 0.5j).
      invalidate_patterns_cache: {
        Args: Record<string, never>
        Returns: Json
      }
      // 0018 — D.15 auto-reset surface. Both anon-callable.
      maybe_reset_demo: {
        Args: Record<string, never>
        Returns: Json
      }
      reset_to_canonical: {
        Args: Record<string, never>
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
// This file is hand-maintained as per requirements. D.49 added profile rule
// columns; D.60-D.62 added the rollover_allocations table + Functions map.
