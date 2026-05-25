-- 0008_rollover_allocations.sql
--
-- Phase 3 Doc 1 — Monthly Ritual + Rollover Allocation.
--
-- Represents the "Where does April's leftover go?" decision: into a goal,
-- the emergency fund, or carry-forward to the next month's safe-to-spend.
--
-- Append-only audit trail — no UPDATE or DELETE policies. The full
-- close-out source_breakdown (per-commitment buffers/overruns +
-- discretionary leftover) is stored as JSON so the history view + case
-- study can replay the decision later.

CREATE TABLE public.rollover_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- The ritual month this allocation closes out. Stored as the 1st of the
  -- month (e.g. 2026-04-01 for the April ritual). DATE type so the FE
  -- can format it any way needed without timezone gymnastics.
  ritual_month date NOT NULL,

  -- Itemized leftover breakdown — see spec for shape:
  --   { "discretionary_leftover": number,
  --     "commitment_buffers":  [{ commitment_id, commitment_name, budgeted, actual, buffer }],
  --     "commitment_overruns": [{ commitment_id, commitment_name, budgeted, actual, overrun }] }
  source_breakdown jsonb NOT NULL,

  -- Net rolled amount: discretionary_leftover + Σ(buffers) − Σ(overruns).
  -- Always positive when this row exists; the negative-leftover branch in
  -- the ritual flow does NOT write a rollover_allocations row.
  total_amount numeric(12,2) NOT NULL,

  destination_kind text NOT NULL CHECK (destination_kind IN ('goal', 'emergency_fund', 'carry_forward')),
  -- Only set when destination_kind = 'goal'. If the goal is later deleted,
  -- the rollover history is preserved (FK set to NULL).
  destination_goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL,

  allocated_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rollover_allocations_user_month ON public.rollover_allocations(user_id, ritual_month);

-- RLS: JOIN-through-profiles pattern (matches the 0007_fix_rls_policies.sql convention).
ALTER TABLE public.rollover_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own rollover_allocations" ON public.rollover_allocations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = rollover_allocations.user_id
      AND profiles.auth_user_id = auth.uid()
  )
);

CREATE POLICY "users insert own rollover_allocations" ON public.rollover_allocations FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = rollover_allocations.user_id
      AND profiles.auth_user_id = auth.uid()
  )
);

-- Intentionally NO update/delete policies — append-only audit trail.
-- A rollover decision, once made, is part of the case-study record.

------------------------------------------------------------------
-- Extend monthly_rituals for the ritual close-out write
------------------------------------------------------------------

ALTER TABLE public.monthly_rituals
  -- Links ritual completion to its allocation. NULL is valid:
  --   - For pre-Phase-3 completed rituals (Jan/Feb/Mar in the seed) — they
  --     completed before this mechanic existed.
  --   - For the negative-leftover branch — April closed at deficit, no
  --     allocation written, but the ritual is still completed.
  ADD COLUMN rollover_allocation_id uuid REFERENCES public.rollover_allocations(id) ON DELETE SET NULL,

  -- Full close-out data snapshot at ritual completion time. Lets the history
  -- view + case study reproduce the ritual UI without recomputing from raw
  -- transactions (which would drift if categories or commitment links change).
  ADD COLUMN close_out_snapshot jsonb;
