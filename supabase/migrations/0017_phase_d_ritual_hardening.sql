-- 0017_phase_d_ritual_hardening.sql
--
-- Phase D housekeeping. Two related changes to the ritual lifecycle:
--
--   1. Backfill `completed_at` on legacy seed-completed rituals
--      (Jan/Feb/Mar 2026 for Priya). The seed migration creates these
--      rows with status='completed' but leaves completed_at NULL because
--      seed-time predates the completed_at convention. Stamps in a
--      synthetic mid-month value so any future query that orders by
--      completed_at has a usable timestamp. New completions (April
--      onward) populate via complete_monthly_ritual / complete_monthly_setup.
--
--   2. Add a precondition to complete_monthly_setup: the M-1 ritual
--      must be in 'completed' state before the M setup can fire. Phase
--      C1 frontend chains them correctly so this isn't a live bug, but
--      a bad-faith client could bypass — closing the gap.
--
-- See PM_DECISIONS Phase 3 Build D.7 and D.8.

------------------------------------------------------------------
-- 1. Backfill legacy completed_at
------------------------------------------------------------------

UPDATE public.monthly_rituals
   SET completed_at = ((month_year || '-01')::date + interval '7 days')::timestamptz
 WHERE status = 'completed'
   AND completed_at IS NULL;

------------------------------------------------------------------
-- 2. complete_monthly_setup precondition
------------------------------------------------------------------
--
-- Same signature, body, and behavior as 0013 — only addition is a
-- precondition check up front that the previous month's ritual is in
-- 'completed' status. CREATE OR REPLACE supersedes the 0013 definition.

CREATE OR REPLACE FUNCTION public.complete_monthly_setup(
  p_month_year             text,
  p_focus_goal_id          uuid,
  p_safe_to_spend_locked   numeric,
  p_confirmed_income       numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id        uuid;
  v_existing_id       uuid;
  v_prev_month_year   text;
  v_prev_status       text;
BEGIN
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found for auth user %', auth.uid();
  END IF;

  -- Phase D precondition: M-1 ritual must be completed.
  -- p_month_year format is 'YYYY-MM' so we compute the previous month by
  -- subtracting one month from the 1st-of-month date and reformatting.
  v_prev_month_year := to_char(
    ((p_month_year || '-01')::date - interval '1 month')::date,
    'YYYY-MM'
  );

  SELECT status INTO v_prev_status
    FROM public.monthly_rituals
   WHERE user_id = v_profile_id
     AND month_year = v_prev_month_year;

  -- No prior-month row at all → reject (the seed always has a row for
  -- the immediately-preceding month for Priya).
  IF v_prev_status IS NULL THEN
    RAISE EXCEPTION 'No monthly_rituals row found for previous month % — cannot set up %', v_prev_month_year, p_month_year;
  END IF;

  IF v_prev_status <> 'completed' THEN
    RAISE EXCEPTION 'Previous month % must be in completed status before setting up % (current status: %)', v_prev_month_year, p_month_year, v_prev_status;
  END IF;

  -- Validate focus_goal_id belongs to this user (if non-null)
  IF p_focus_goal_id IS NOT NULL THEN
    PERFORM 1 FROM public.goals
      WHERE id = p_focus_goal_id AND user_id = v_profile_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'focus_goal_id % not found for user %', p_focus_goal_id, v_profile_id;
    END IF;
  END IF;

  -- UPSERT — May ritual row may not exist yet on first setup. If it does
  -- (e.g. user re-runs setup), update the existing row.
  SELECT id INTO v_existing_id
  FROM public.monthly_rituals
  WHERE user_id = v_profile_id AND month_year = p_month_year;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.monthly_rituals (
      user_id, month_year, status, income_confirmed,
      commitments_confirmed, focus_goal_id, safe_to_spend_locked, completed_at
    )
    VALUES (
      v_profile_id, p_month_year, 'completed', p_confirmed_income,
      true, p_focus_goal_id, p_safe_to_spend_locked, now()
    )
    RETURNING id INTO v_existing_id;
  ELSE
    UPDATE public.monthly_rituals
    SET status = 'completed',
        income_confirmed = p_confirmed_income,
        commitments_confirmed = true,
        focus_goal_id = p_focus_goal_id,
        safe_to_spend_locked = p_safe_to_spend_locked,
        completed_at = now()
    WHERE id = v_existing_id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'completed',
    'ritual_id', v_existing_id,
    'month_year', p_month_year,
    'safe_to_spend_locked', p_safe_to_spend_locked,
    'focus_goal_id', p_focus_goal_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_monthly_setup(text, uuid, numeric, numeric) TO authenticated;
