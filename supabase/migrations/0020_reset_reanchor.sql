-- Migration 0020 — Re-anchor demo dates inside reset_to_canonical().
--
-- Problem: the seed places transactions at fixed offsets from a literal
-- `v_demo_today` that apply-migrations.js substitutes at seed-time with
-- the 1st-of-current-month IST. Meanwhile `src/lib/dates.ts` computes
-- DEMO_TODAY dynamically at module load. After a calendar-month rollover,
-- the dynamic anchor moves forward but the seeded dates don't — so the
-- variable-spending merchants (Myntra/Toit/Mainland China at days-ago
-- offsets) fall outside Reflect's 30-day window, leaving only the
-- recurring commitments visible.
--
-- Fix: when reset_to_canonical runs, compute the delta between the seed
-- anchor (derived as MAX(occurred_at) + 1 day — the seed always places
-- the most recent txn at v_demo_today - 1 day) and the current 1st-of-
-- month IST. If the delta is >= 1 day, shift every dated row forward:
-- transactions, reflections (both live + snapshot), and windfalls.
--
-- Out of scope: monthly_rituals.month_year is a YYYY-MM text string and
-- needs a separate shift (also has hardcoded '2026-04' references in
-- 0018 itself). Tracked for a follow-up.

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

  ----------------------------------------------------------------
  -- 0. RE-ANCHOR DATES (0020 addition)
  ----------------------------------------------------------------
  -- Runs FIRST, before 2h's snapshot restore — so when 2h re-inserts
  -- reflections from reflections_seed_snapshot, it reads the
  -- already-shifted reflected_at values.
  v_current_anchor := (
    date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata')::date)::timestamp
    + interval '9 hours'
  ) AT TIME ZONE 'Asia/Kolkata';

  SELECT MAX(occurred_at) + interval '1 day' INTO v_seed_anchor
    FROM public.transactions
   WHERE user_id = v_priya_id;

  IF v_seed_anchor IS NOT NULL THEN
    v_delta := v_current_anchor - v_seed_anchor;
    -- Only shift when the gap is at least a full day. Within-day resets
    -- (same calendar day as last seed/reset) are no-ops — avoids
    -- churning timestamps on repeated reviewer-tool clicks.
    IF v_delta >= interval '1 day' THEN
      UPDATE public.transactions
         SET occurred_at = occurred_at + v_delta
       WHERE user_id = v_priya_id;
      GET DIAGNOSTICS v_shifted_txns = ROW_COUNT;

      UPDATE public.reflections
         SET reflected_at = reflected_at + v_delta
       WHERE user_id = v_priya_id;
      GET DIAGNOSTICS v_shifted_refs = ROW_COUNT;

      -- Snapshot also shifts so subsequent restores stay current.
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
  -- Existing reset logic (unchanged from 0018)
  ----------------------------------------------------------------

  -- 2a. Revert rollover allocations + decrement destination goals
  -- (mirrors reset_april_ritual from 0011 but scoped to ALL of Priya's
  -- rollover_allocations, not just April).
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

  -- 2b. Reset any past-seed ritual completions to pending (Jan/Feb/Mar
  -- 2026 are seed-completed but the seed restores them on apply-migrations;
  -- here we only revert April — the canonical pending row).
  UPDATE public.monthly_rituals
     SET status = 'pending', completed_at = NULL, close_out_snapshot = NULL
   WHERE user_id = v_priya_id AND month_year = '2026-04';

  -- 2c. Delete any forward-month rituals created via complete_monthly_setup
  -- (May 2026 onward). Seed only ships ritual rows through M-1 = April.
  DELETE FROM public.monthly_rituals
   WHERE user_id = v_priya_id
     AND month_year > '2026-04';

  -- 2d. Reset windfalls to pending_allocation state
  UPDATE public.windfalls
     SET status = 'pending_allocation', allocations = NULL, allocated_at = NULL
   WHERE user_id = v_priya_id AND status <> 'pending_allocation';

  -- 2e. Wipe chat_messages
  DELETE FROM public.chat_messages WHERE user_id = v_priya_id;

  -- 2f. Wipe saved_decisions (FK to chat_messages was already ON DELETE SET NULL,
  -- so this can run in either order safely).
  DELETE FROM public.saved_decisions WHERE user_id = v_priya_id;

  -- 2g. Invalidate patterns cache
  DELETE FROM public.reflection_patterns_cache WHERE user_id = v_priya_id;

  -- 2h. Restore reflections from snapshot (same pattern as
  -- reset_reflections_to_seed in 0010). Only restore if a snapshot exists.
  -- NB: snapshot's reflected_at was already shifted above in step 0, so
  -- restored reflections land at the correct (current-month-relative) times.
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
