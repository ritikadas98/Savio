-- 0018_demo_auto_reset.sql
--
-- Phase D-followup: portfolio-demo state hygiene.
--
-- This is a single-tenant demo: every reviewer signs in as Priya, and any
-- state changes (chat messages, ritual completions, windfall allocations,
-- ad-hoc reflections, saved decisions) bleed across reviewer sessions.
-- Without an auto-reset mechanism, reviewer B sees reviewer A's chat
-- history, allocated windfalls, completed rituals, etc.
--
-- This migration adds:
--
--   1. `system_state` — one-row table tracking when the demo was last
--      reset. Constraint enforces single row.
--
--   2. `reset_to_canonical()` — full-state reset RPC. Wipes ephemeral
--      data, reverts rollover allocations + their goal mutations, restores
--      reflections from snapshot, and stamps `system_state.last_reset_at`.
--      Resolves Priya by hardcoded email (single-tenant demo) — does NOT
--      require auth context, so it can be invoked from a logged-out
--      client. Idempotent — running twice is harmless (second run is a
--      no-op on top of a freshly-reset state).
--
--   3. `maybe_reset_demo()` — cooldown-gated wrapper around #2. Reads
--      `system_state.last_reset_at` and only invokes the full reset if
--      the cooldown (60 min) has elapsed. Returns a JSON summary either
--      way so the caller can log the decision.
--
-- Trigger point: `src/lib/auth.ts::loginAsPriya()` calls `maybe_reset_demo`
-- after a successful sign-in. Reviewer Console gains a manual override
-- that calls `reset_to_canonical` directly (bypassing cooldown).
--
-- All three RPCs are SECURITY DEFINER and GRANTed to both `anon` and
-- `authenticated` — the demo intentionally exposes the reset surface
-- broadly because there's nothing private to protect; the worst a
-- malicious caller could do is wipe Priya's ephemeral state, which is
-- exactly what the reset is for.

------------------------------------------------------------------
-- 1. system_state — last-reset tracker
------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.system_state (
  id            smallint    PRIMARY KEY DEFAULT 1,
  last_reset_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO public.system_state (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- The row is world-readable so the Reviewer Console can show the
-- "last reset N minutes ago" hint. Writes happen only via the RPCs
-- below, which run SECURITY DEFINER and bypass RLS.
ALTER TABLE public.system_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_state public read" ON public.system_state;
CREATE POLICY "system_state public read" ON public.system_state
  FOR SELECT USING (true);

------------------------------------------------------------------
-- 2. reset_to_canonical()
------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reset_to_canonical()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_priya_id       uuid;
  v_alloc          record;
  v_reverted_count int := 0;
  v_wiped          jsonb := '{}'::jsonb;
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

------------------------------------------------------------------
-- 3. maybe_reset_demo() — cooldown-gated trigger
------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.maybe_reset_demo()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_reset     timestamptz;
  v_cooldown       interval := interval '60 minutes';
  v_minutes_left   numeric;
BEGIN
  -- Defensive: if system_state row somehow missing, treat as "needs reset".
  SELECT last_reset_at INTO v_last_reset FROM public.system_state WHERE id = 1;
  IF v_last_reset IS NULL THEN
    INSERT INTO public.system_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
    v_last_reset := now() - v_cooldown - interval '1 minute';
  END IF;

  IF (now() - v_last_reset) >= v_cooldown THEN
    PERFORM public.reset_to_canonical();
    RETURN jsonb_build_object(
      'reset', true,
      'message', 'Demo state reset (cooldown elapsed)',
      'last_reset_at', now()
    );
  END IF;

  v_minutes_left := EXTRACT(EPOCH FROM (v_cooldown - (now() - v_last_reset))) / 60;
  RETURN jsonb_build_object(
    'reset', false,
    'message', 'Within cooldown window — no reset',
    'last_reset_at',     v_last_reset,
    'minutes_remaining', round(v_minutes_left, 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.maybe_reset_demo() TO anon, authenticated;
