-- 0011_split_rollover_schema_and_rpcs.sql
--
-- Phase 3 Doc 1.2 — Split rollover with multi-destination allocation.
--
-- This migration extends the rollover model from one-destination-per-ritual
-- to many-destinations-per-ritual. The user can now allocate their leftover
-- across multiple goals + emergency fund + carry-forward, with exact-sum
-- validation enforced by the UI.
--
-- Three things happen here, in order:
--   1. Drop the old single-allocation RPC and its sibling reset RPC, then
--      drop the now-ambiguous monthly_rituals.rollover_allocation_id FK
--      column. Order matters: the old RPC bodies reference that column.
--   2. Create the new complete_monthly_ritual(p_month_year, p_allocations)
--      that accepts a jsonb array of allocation objects and writes one
--      rollover_allocations row per element, atomically.
--   3. Create the new reset_april_ritual() that queries allocations by
--      ritual_month (instead of the dropped FK), reverts each destination
--      balance, deletes all allocation rows, and marks the ritual pending.
--
-- The append-only audit invariant on rollover_allocations is preserved —
-- each row still carries the full source_breakdown (duplicated across rows
-- of one ritual, intentional — see Doc 1.2 Stream A.1 design notes).

------------------------------------------------------------------
-- A.1 — Drop old RPCs and the FK column
------------------------------------------------------------------

-- Old 7-arg signature. Explicit DROP so we don't end up with two
-- coexisting overloads after the new 2-arg version is created.
DROP FUNCTION IF EXISTS public.complete_monthly_ritual(text, boolean, jsonb, numeric, text, uuid, jsonb);

-- Old reset_april_ritual reads monthly_rituals.rollover_allocation_id —
-- has to be dropped before the column it references.
DROP FUNCTION IF EXISTS public.reset_april_ritual();

-- Now safe to drop the column. The FK constraint to rollover_allocations(id)
-- goes with it automatically. Seeded Jan/Feb/Mar rituals stored NULL here, so
-- no historical data is lost. Post-Doc-1 completed rituals (e.g. April after
-- gate3-ritual-walkthrough) lose the back-pointer but their allocations
-- remain queryable via rollover_allocations.ritual_month.
ALTER TABLE public.monthly_rituals
  DROP COLUMN IF EXISTS rollover_allocation_id;

------------------------------------------------------------------
-- A.2 — complete_monthly_ritual (new 2-arg signature)
------------------------------------------------------------------
--
-- Accepts a jsonb array of allocation objects. Each element shape:
--   {
--     "destination_kind":    "goal" | "emergency_fund" | "carry_forward",
--     "destination_goal_id": uuid     (required for goal/emergency_fund),
--     "total_amount":        numeric  (positive),
--     "source_breakdown":    jsonb    (optional; defaults to {})
--   }
--
-- Empty array → skip-rollover branch (negative-leftover path). No
-- rollover_allocations rows written; ritual is still marked completed
-- and close_out_snapshot.allocations = [].
--
-- Non-empty array → one rollover_allocations row per element, plus a
-- balance update on each goal/emergency_fund destination. All writes
-- happen inside the implicit function transaction, so a failure on
-- any row rolls back all rows + the ritual state change.
--
-- Returns:
--   { "status": "completed",
--     "allocations_written": N,
--     "allocation_ids": [uuid, uuid, ...] }

CREATE OR REPLACE FUNCTION public.complete_monthly_ritual(
  p_month_year  text,
  p_allocations jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_profile_id    uuid;
  v_ritual_month  date;
  v_ritual_id     uuid;
  v_allocation    jsonb;
  v_kind          text;
  v_goal_id       uuid;
  v_amount        numeric;
  v_breakdown     jsonb;
  v_new_id        uuid;
  v_inserted_ids  uuid[] := ARRAY[]::uuid[];
  v_n             int;
BEGIN
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found for auth user %', auth.uid();
  END IF;

  v_ritual_month := (p_month_year || '-01')::date;

  SELECT id INTO v_ritual_id
  FROM public.monthly_rituals
  WHERE user_id = v_profile_id AND month_year = p_month_year;
  IF v_ritual_id IS NULL THEN
    RAISE EXCEPTION 'No monthly_rituals row found for user % month %', v_profile_id, p_month_year;
  END IF;

  v_n := jsonb_array_length(COALESCE(p_allocations, '[]'::jsonb));

  -- Validate and write each allocation. Loop body is a no-op for empty array.
  FOR v_allocation IN SELECT * FROM jsonb_array_elements(COALESCE(p_allocations, '[]'::jsonb)) LOOP
    v_kind := v_allocation->>'destination_kind';
    IF v_kind IS NULL OR v_kind NOT IN ('goal','emergency_fund','carry_forward') THEN
      RAISE EXCEPTION 'Invalid destination_kind: %', v_kind;
    END IF;

    v_amount := (v_allocation->>'total_amount')::numeric;
    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'total_amount must be positive (got % for kind %)', v_amount, v_kind;
    END IF;

    IF v_kind IN ('goal','emergency_fund') THEN
      v_goal_id := (v_allocation->>'destination_goal_id')::uuid;
      IF v_goal_id IS NULL THEN
        RAISE EXCEPTION 'destination_goal_id required when destination_kind = %', v_kind;
      END IF;
    ELSE
      v_goal_id := NULL;
    END IF;

    -- source_breakdown is NOT NULL on the table. Default to '{}' if caller omits.
    v_breakdown := COALESCE(v_allocation->'source_breakdown', '{}'::jsonb);

    INSERT INTO public.rollover_allocations (
      user_id, ritual_month, source_breakdown, total_amount,
      destination_kind, destination_goal_id
    ) VALUES (
      v_profile_id, v_ritual_month, v_breakdown, v_amount,
      v_kind, v_goal_id
    )
    RETURNING id INTO v_new_id;

    v_inserted_ids := array_append(v_inserted_ids, v_new_id);

    -- Credit goal/emergency_fund balance. carry_forward has no separate write —
    -- safe-to-spend reads rollover_allocations live for the previous month.
    IF v_kind IN ('goal','emergency_fund') THEN
      UPDATE public.goals
      SET current_amount = COALESCE(current_amount, 0) + v_amount
      WHERE id = v_goal_id AND user_id = v_profile_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Destination goal % not found for user %', v_goal_id, v_profile_id;
      END IF;
    END IF;
  END LOOP;

  -- Mark ritual complete. Merge allocations into close_out_snapshot rather than
  -- overwrite so any pre-existing snapshot (e.g. a richer ritual-close-out
  -- payload, none today but defensive) survives.
  UPDATE public.monthly_rituals
  SET status = 'completed',
      completed_at = now(),
      close_out_snapshot = COALESCE(close_out_snapshot, '{}'::jsonb)
                           || jsonb_build_object('allocations', COALESCE(p_allocations, '[]'::jsonb))
  WHERE id = v_ritual_id;

  RETURN jsonb_build_object(
    'status', 'completed',
    'allocations_written', v_n,
    'allocation_ids', to_jsonb(v_inserted_ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_monthly_ritual(text, jsonb) TO authenticated;

------------------------------------------------------------------
-- A.3 — reset_april_ritual (multi-allocation aware)
------------------------------------------------------------------
--
-- Queries rollover_allocations by ritual_month (instead of the dropped
-- monthly_rituals.rollover_allocation_id FK), reverts each destination
-- balance, deletes all allocation rows for the ritual, and resets the
-- ritual to pending.
--
-- Return shape changed from Doc 1's single-allocation form
-- ({ reverted_amount, reverted_destination_kind, reverted_goal_name })
-- to a multi-allocation form
-- ({ reverted_total, reverted_count, reverted_allocations: [...] }).
--
-- The Reviewer Console UI (ResetActionRow) only reads result.status and
-- result.message, so the shape change doesn't break the UI. The verify
-- script (phase3.5-verify.mjs) reads the specifics and is updated in
-- the same task.

CREATE OR REPLACE FUNCTION public.reset_april_ritual()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        uuid;
  v_ritual_id      uuid;
  v_ritual_status  text;
  v_alloc          record;
  v_reverted_total numeric := 0;
  v_reverted_count int := 0;
  v_alloc_summary  jsonb := '[]'::jsonb;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE auth_user_id = auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No profile found for current user';
  END IF;

  SELECT id, status
    INTO v_ritual_id, v_ritual_status
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

  -- Revert each allocation's destination balance, accumulate summary.
  FOR v_alloc IN
    SELECT id, total_amount, destination_kind, destination_goal_id
    FROM public.rollover_allocations
    WHERE user_id = v_user_id AND ritual_month = '2026-04-01'
  LOOP
    IF v_alloc.destination_kind IN ('goal','emergency_fund')
       AND v_alloc.destination_goal_id IS NOT NULL THEN
      UPDATE public.goals
      SET current_amount = GREATEST(0, COALESCE(current_amount, 0) - v_alloc.total_amount)
      WHERE id = v_alloc.destination_goal_id;
    END IF;
    -- carry_forward: no separate balance to revert; deleting the row
    -- below removes its contribution to next-month safe-to-spend.

    v_reverted_total := v_reverted_total + v_alloc.total_amount;
    v_reverted_count := v_reverted_count + 1;
    v_alloc_summary := v_alloc_summary || jsonb_build_object(
      'total_amount', v_alloc.total_amount,
      'destination_kind', v_alloc.destination_kind,
      'destination_goal_id', v_alloc.destination_goal_id
    );
  END LOOP;

  DELETE FROM public.rollover_allocations
  WHERE user_id = v_user_id AND ritual_month = '2026-04-01';

  UPDATE public.monthly_rituals
  SET status = 'pending',
      completed_at = NULL,
      close_out_snapshot = NULL
  WHERE id = v_ritual_id;

  RETURN jsonb_build_object(
    'status', 'reset',
    'message', 'April ritual reset to pending',
    'reverted_total', v_reverted_total,
    'reverted_count', v_reverted_count,
    'reverted_allocations', v_alloc_summary
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_april_ritual() TO authenticated;
