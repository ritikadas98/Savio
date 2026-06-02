-- Migration 0021 — Dynamic month resolution for the reset path.
--
-- Stream 0.5x. Companion to 0020. The seed (0006) now derives the four
-- monthly_rituals rows from v_demo_today instead of hardcoding
-- '2026-01'..'2026-04', so the "M-1 pending, M-2/M-3/M-4 completed"
-- invariant survives calendar-month rollovers. reset_to_canonical also
-- needs to participate: its 2b/2c steps referenced the literal
-- '2026-04' as both "the pending ritual to revert" and "the cutoff for
-- forward-month ritual deletions." After this migration, both branches
-- compute the cutoff from now() at 9 AM IST → M-1, so the function
-- stays correct under arbitrary calendar drift without further edits.

CREATE OR REPLACE FUNCTION public.reset_to_canonical()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_priya_id        uuid;
  v_alloc           record;
  v_reverted_count  int := 0;
  v_wiped           jsonb := '{}'::jsonb;
  v_current_anchor  timestamptz;
  v_seed_anchor     timestamptz;
  v_delta           interval;
  v_shifted_txns    int := 0;
  v_shifted_refs    int := 0;
  v_shifted_windf   int := 0;
  v_pending_month   text;  -- M-1 dynamically (Stream 0.5x)
BEGIN
  -- Single-tenant demo: resolve Priya by canonical email. If the seed
  -- is somehow missing her profile, abort rather than guessing.
  SELECT id INTO v_priya_id
    FROM public.profiles
   WHERE email = 'priya@savio.demo'
   LIMIT 1;
  IF v_priya_id IS NULL THEN
    RAISE EXCEPTION 'Priya profile not found — cannot reset';
  END IF;

  -- Compute M-1 (the canonical pending close-out) from current IST.
  -- Used by 2b/2c below.
  v_pending_month := to_char(
    (now() AT TIME ZONE 'Asia/Kolkata')::date - interval '1 month',
    'YYYY-MM'
  );

  ----------------------------------------------------------------
  -- 0. RE-ANCHOR DATES (0020 carry-over)
  ----------------------------------------------------------------
  v_current_anchor := (
    date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata')::date)::timestamp
    + interval '9 hours'
  ) AT TIME ZONE 'Asia/Kolkata';

  SELECT MAX(occurred_at) + interval '1 day' INTO v_seed_anchor
    FROM public.transactions
   WHERE user_id = v_priya_id;

  IF v_seed_anchor IS NOT NULL THEN
    v_delta := v_current_anchor - v_seed_anchor;
    IF v_delta >= interval '1 day' THEN
      UPDATE public.transactions
         SET occurred_at = occurred_at + v_delta
       WHERE user_id = v_priya_id;
      GET DIAGNOSTICS v_shifted_txns = ROW_COUNT;

      UPDATE public.reflections
         SET reflected_at = reflected_at + v_delta
       WHERE user_id = v_priya_id;
      GET DIAGNOSTICS v_shifted_refs = ROW_COUNT;

      UPDATE public.reflections_seed_snapshot
         SET reflected_at = reflected_at + v_delta
       WHERE user_id = v_priya_id;

      UPDATE public.windfalls
         SET detected_at = detected_at + v_delta
       WHERE user_id = v_priya_id;
      GET DIAGNOSTICS v_shifted_windf = ROW_COUNT;
    END IF;
  END IF;

  ----------------------------------------------------------------
  -- Existing reset logic
  ----------------------------------------------------------------

  -- 2a. Revert rollover allocations + decrement destination goals
  FOR v_alloc IN
    SELECT id, total_amount, destination_kind, destination_goal_id
      FROM public.rollover_allocations
     WHERE user_id = v_priya_id
  LOOP
    IF v_alloc.destination_kind IN ('goal','emergency_fund')
       AND v_alloc.destination_goal_id IS NOT NULL THEN
      UPDATE public.goals
         SET current_amount = GREATEST(0, COALESCE(current_amount, 0) - v_alloc.total_amount)
       WHERE id = v_alloc.destination_goal_id;
    END IF;
    v_reverted_count := v_reverted_count + 1;
  END LOOP;
  DELETE FROM public.rollover_allocations WHERE user_id = v_priya_id;

  -- 2b. Reset M-1 (the canonical pending ritual per the seed) back to
  -- pending. Stream 0.5x — month derived from now() instead of hardcoded
  -- so this stays correct across calendar-month rollovers.
  UPDATE public.monthly_rituals
     SET status = 'pending', completed_at = NULL, close_out_snapshot = NULL
   WHERE user_id = v_priya_id AND month_year = v_pending_month;

  -- 2c. Delete any forward-month rituals created via complete_monthly_setup
  -- (anything after M-1). Seed only ships ritual rows through M-1.
  DELETE FROM public.monthly_rituals
   WHERE user_id = v_priya_id
     AND month_year > v_pending_month;

  -- 2d. Reset windfalls to pending_allocation state
  UPDATE public.windfalls
     SET status = 'pending_allocation', allocations = NULL, allocated_at = NULL
   WHERE user_id = v_priya_id AND status <> 'pending_allocation';

  -- 2e. Wipe chat_messages
  DELETE FROM public.chat_messages WHERE user_id = v_priya_id;

  -- 2f. Wipe saved_decisions
  DELETE FROM public.saved_decisions WHERE user_id = v_priya_id;

  -- 2g. Invalidate patterns cache
  DELETE FROM public.reflection_patterns_cache WHERE user_id = v_priya_id;

  -- 2h. Restore reflections from snapshot. Snapshot's reflected_at was
  -- shifted above in step 0, so restored reflections land at the correct
  -- (current-month-relative) times.
  IF EXISTS (SELECT 1 FROM public.reflections_seed_snapshot WHERE user_id = v_priya_id) THEN
    DELETE FROM public.reflections WHERE user_id = v_priya_id;
    INSERT INTO public.reflections (user_id, transaction_id, label, reflected_at)
      SELECT user_id, transaction_id, label, reflected_at
        FROM public.reflections_seed_snapshot
       WHERE user_id = v_priya_id;
  END IF;

  -- 2i. Stamp last_reset_at
  UPDATE public.system_state SET last_reset_at = now() WHERE id = 1;

  v_wiped := jsonb_build_object(
    'reverted_rollover_count', v_reverted_count,
    'pending_month',           v_pending_month,
    'reanchor_delta_days',     COALESCE(EXTRACT(EPOCH FROM v_delta) / 86400, 0),
    'shifted_transactions',    v_shifted_txns,
    'shifted_reflections',     v_shifted_refs,
    'shifted_windfalls',       v_shifted_windf,
    'reset_at',                now()
  );

  RETURN jsonb_build_object(
    'status',  'reset',
    'message', 'Demo state restored to canonical',
    'details', v_wiped
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_to_canonical() TO anon, authenticated;
