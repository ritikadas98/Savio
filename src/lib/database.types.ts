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
  }
}
// This file is hand-maintained as per requirements.
