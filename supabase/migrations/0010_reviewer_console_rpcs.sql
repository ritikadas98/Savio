-- 0010_reviewer_console_rpcs.sql
--
-- Phase 3.5 — Reviewer Console.
--
-- Three RPCs that let a reviewer reset demo state from the /profile UI:
--   1. reset_april_ritual()      — undo a completed April ritual
--   2. clear_chat_history()      — wipe chat_messages for the user
--   3. reset_reflections_to_seed()— restore reflections to the seeded set
--
-- Plus the snapshot table needed by (3). The seed file (0006_seed_priya.sql)
-- populates the snapshot at the same time it inserts reflections, so the
-- snapshot stays in sync with whatever the seed's "canonical" reflection
-- set is across reseeds.
--
-- Pattern: SECURITY DEFINER so the function bypasses RLS for cross-table
-- updates; user isolation is enforced by resolving auth.uid() → profiles.id
-- at the start of each function, then scoping every query by that user_id.
-- Same pattern as complete_monthly_ritual in 0009.

------------------------------------------------------------------
-- A.4 — Reflections seed snapshot
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reflections_seed_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (label IN ('glad', 'regret', 'neutral')),
  reflected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_reflections_seed_snapshot_user ON public.reflections_seed_snapshot(user_id);

ALTER TABLE public.reflections_seed_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own reflection snapshot" ON public.reflections_seed_snapshot FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = reflections_seed_snapshot.user_id
      AND profiles.auth_user_id = auth.uid()
  )
);

-- No INSERT/UPDATE/DELETE policies — the snapshot is populated only by the
-- seed migration (which runs as superuser) and read by the RPC. End users
-- can't mutate it directly.

-- Initial backfill: capture whatever reflections the seed (0006) wrote.
-- This runs at superuser privilege (during migration), so RLS doesn't
-- apply. Re-running the seed re-applies 0010, which re-runs this backfill
-- against the freshly-seeded reflections.
INSERT INTO public.reflections_seed_snapshot (user_id, transaction_id, label, reflected_at)
SELECT user_id, transaction_id, label, reflected_at
FROM public.reflections
ON CONFLICT (user_id, transaction_id) DO NOTHING;

------------------------------------------------------------------
-- RPC: reset_april_ritual()
------------------------------------------------------------------
-- Undoes a completed April ritual:
--   - Reverts the linked goal balance (if destination_kind = 'goal' or
--     'emergency_fund')
--   - Deletes the rollover_allocations row
--   - Resets monthly_rituals row to status='pending', completed_at=NULL,
--     rollover_allocation_id=NULL, close_out_snapshot=NULL
--
-- Idempotent: returns 'already_pending' if April is already pending,
-- 'not_found' if April ritual doesn't exist for this user.
--
-- April-specific in this MVP. A future generalization could accept
-- p_month_year as a parameter; deferred.

CREATE OR REPLACE FUNCTION public.reset_april_ritual()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_ritual_id uuid;
  v_ritual_status text;
  v_allocation_id uuid;
  v_allocation public.rollover_allocations%ROWTYPE;
  v_goal_name text;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE auth_user_id = auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No profile found for current user';
  END IF;

  -- Find the April ritual row. month_year is TEXT ('YYYY-MM'), not a date.
  SELECT id, status, rollover_allocation_id
    INTO v_ritual_id, v_ritual_status, v_allocation_id
  FROM public.monthly_rituals
  WHERE user_id = v_user_id AND month_year = '2026-04';

  IF v_ritual_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'not_found',
      'message', 'No April ritual found for current user'
    );
  END IF;

  IF v_ritual_status = 'pending' THEN
    RETURN jsonb_build_object(
      'status', 'already_pending',
      'message', 'April ritual is already pending — nothing to reset'
    );
  END IF;

  -- Read the allocation (if any) before deleting so we can revert balances
  IF v_allocation_id IS NOT NULL THEN
    SELECT * INTO v_allocation FROM public.rollover_allocations WHERE id = v_allocation_id;

    -- Revert the goal balance for goal/emergency_fund destinations
    IF v_allocation.destination_kind IN ('goal', 'emergency_fund') AND v_allocation.destination_goal_id IS NOT NULL THEN
      UPDATE public.goals
      SET current_amount = GREATEST(0, COALESCE(current_amount, 0) - v_allocation.total_amount)
      WHERE id = v_allocation.destination_goal_id
      RETURNING label INTO v_goal_name;
    END IF;

    -- carry_forward has no separate write — safe-to-spend formula reads
    -- rollover_allocations live, so deleting the row reverts the effect.

    DELETE FROM public.rollover_allocations WHERE id = v_allocation_id;
  END IF;

  UPDATE public.monthly_rituals
  SET status = 'pending',
      completed_at = NULL,
      rollover_allocation_id = NULL,
      close_out_snapshot = NULL
  WHERE id = v_ritual_id;

  RETURN jsonb_build_object(
    'status', 'reset',
    'message', 'April ritual reset to pending',
    'reverted_amount', COALESCE(v_allocation.total_amount, 0),
    'reverted_destination_kind', v_allocation.destination_kind,
    'reverted_goal_name', v_goal_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_april_ritual() TO authenticated;

------------------------------------------------------------------
-- RPC: clear_chat_history()
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clear_chat_history()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_deleted_count integer;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE auth_user_id = auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No profile found for current user';
  END IF;

  WITH deleted AS (
    DELETE FROM public.chat_messages WHERE user_id = v_user_id RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  RETURN jsonb_build_object(
    'status', 'cleared',
    'message', CASE
      WHEN v_deleted_count = 0 THEN 'Chat history was already empty'
      ELSE 'Chat history cleared'
    END,
    'deleted_count', v_deleted_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_chat_history() TO authenticated;

------------------------------------------------------------------
-- RPC: reset_reflections_to_seed()
------------------------------------------------------------------
-- Deletes all reflection rows for the user, then re-inserts from
-- reflections_seed_snapshot. The snapshot was populated by the seed
-- migration with whatever reflections were canonical at seed time.

CREATE OR REPLACE FUNCTION public.reset_reflections_to_seed()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_deleted_count integer;
  v_restored_count integer;
  v_snapshot_count integer;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE auth_user_id = auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No profile found for current user';
  END IF;

  -- Sanity: confirm a snapshot exists. If not, refuse rather than
  -- silently wiping reflections with nothing to restore.
  SELECT COUNT(*) INTO v_snapshot_count
  FROM public.reflections_seed_snapshot WHERE user_id = v_user_id;

  IF v_snapshot_count = 0 THEN
    RETURN jsonb_build_object(
      'status', 'no_snapshot',
      'message', 'No reflection snapshot found. Run apply-migrations.js to regenerate the seed.'
    );
  END IF;

  WITH deleted AS (
    DELETE FROM public.reflections WHERE user_id = v_user_id RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  WITH inserted AS (
    INSERT INTO public.reflections (user_id, transaction_id, label, reflected_at)
    SELECT user_id, transaction_id, label, reflected_at
    FROM public.reflections_seed_snapshot
    WHERE user_id = v_user_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_restored_count FROM inserted;

  RETURN jsonb_build_object(
    'status', 'restored',
    'message', CASE
      WHEN v_deleted_count = v_restored_count THEN 'Reflections were already in seeded state'
      ELSE 'Reflections restored to seeded state'
    END,
    'deleted_count', v_deleted_count,
    'restored_count', v_restored_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_reflections_to_seed() TO authenticated;
