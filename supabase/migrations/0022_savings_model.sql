-- Migration 0022 — D.65 Spec 2 — savings model foundation.
--
-- Adds the schema columns the savings/cushion derivation needs:
--   profiles.unearmarked_liquid  — stated liquid balance NOT earmarked
--                                  to any goal. The ONLY spendable cushion
--                                  (per Spec 2's "one line, several pots"
--                                  principle). V1 is a stated figure
--                                  captured at onboarding; real
--                                  bank-fetched balance is V2.
--   goals.backs_safety_net       — flag the goal whose current_amount
--                                  "covers" the safety net floor. For
--                                  Priya, the Emergency fund. Single
--                                  source replaces the D.62 proxy
--                                  ("emergency fund goal current_amount"
--                                  as a hardcoded assumption).
--
-- Cushion derivation lives in src/lib/savings.ts + the Deno mirror —
-- this migration only adds the underlying columns.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS unearmarked_liquid numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.unearmarked_liquid IS
  'D.65: stated liquid balance not earmarked to any goal. Cushion = unearmarked_liquid − safety_net. V2: real bank-fetched balance.';

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS backs_safety_net boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.goals.backs_safety_net IS
  'D.65: true when this goal''s current_amount is what conceptually covers the safety net floor. Typically the Emergency fund. Replaces D.62''s hardcoded emergency-fund proxy.';

-- Partial unique index: at most one goal per user backs the safety net.
-- (Sanity guard — the UI assumes exactly 0 or 1 row matches per user.)
CREATE UNIQUE INDEX IF NOT EXISTS goals_one_safety_net_backer
  ON public.goals (user_id)
  WHERE backs_safety_net = true;

-- ─────────────────────────────────────────────────────────────────────
-- Priya backfill
-- ─────────────────────────────────────────────────────────────────────
-- Migrations run in numeric order (0006 seed → 0022 schema), so we can't
-- reference these new columns from the seed itself. Set Priya's values
-- here. ₹50,000 liquid produces a non-zero cushion (₹50K − ₹1L safety
-- net = … negative? — see below) so Spec 3 has something to demo.
--
-- Note on the math: Spec 2 defines cushion = unearmarked_liquid −
-- safety_net. With Priya at ₹50,000 liquid and ₹1,00,000 safety_net,
-- raw cushion is NEGATIVE (₹-50,000) — the safety-net floor isn't even
-- covered by unearmarked liquid alone. The emergency-fund goal
-- (₹1,84,000 current, backs_safety_net=true) covers the floor on its
-- own, so the surface should render "Floor covered by Emergency fund;
-- ₹50,000 unearmarked above it" rather than a negative number. The
-- savings module handles this presentation; the schema just stores raw
-- balances.
UPDATE public.profiles
   SET unearmarked_liquid = 50000
 WHERE id = '00000000-0000-4000-a000-000000000001'
   AND unearmarked_liquid = 0;  -- idempotent: only sets the default; user edits preserved

UPDATE public.goals
   SET backs_safety_net = true
 WHERE id = 'c0000000-0000-4000-a000-000000000002';  -- Emergency fund
