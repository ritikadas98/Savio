-- 0019_add_user_rules_to_profiles.sql
-- Stream 0.5t Piece #4 (D.49): move user rules from hardcoded constants in
-- supabase/functions/chat-respond/prompt_builder.ts to schema columns on
-- the profiles row. Resolves the C.11-deferred "expose as editable profile
-- settings" V2 work and the Stream 0.5s side-finding 1 drift between
-- prompt_builder (₹2,000) and Profile UI (₹3,000) — single source of truth
-- per-user row, no separate hardcoded copy that can fall out of sync.
--
-- Defaults match the pre-D.49 prompt_builder values, EXCEPT
-- impulse_wait_threshold which corrects to ₹3,000 (the Profile-UI-displayed
-- value; the ₹2,000 in the prompt was the drift bug). Resolves Stream 0.5t
-- side-finding 1 by construction.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS safety_net             integer NOT NULL DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS impulse_wait_threshold integer NOT NULL DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS impulse_wait_hours     integer NOT NULL DEFAULT 48,
  ADD COLUMN IF NOT EXISTS daily_sps_floor        integer NOT NULL DEFAULT 300;

-- Backfill any existing rows (Priya's seed) with explicit values rather
-- than relying on the column defaults. Explicit is auditable; defaults
-- are silent. Same values also written into 0006_seed_priya.sql so a
-- fresh apply-migrations.js run produces identical state.
UPDATE public.profiles
   SET safety_net             = 100000,
       impulse_wait_threshold = 3000,
       impulse_wait_hours     = 48,
       daily_sps_floor        = 300
 WHERE email = 'priya@savio.demo';

COMMENT ON COLUMN public.profiles.safety_net             IS 'User rule: minimum accessible cash to preserve (₹). Renamed from "buffer floor" in Stream 0.5t D.48.';
COMMENT ON COLUMN public.profiles.impulse_wait_threshold IS 'User rule: amount above which the impulse-wait cooling-off period applies (₹).';
COMMENT ON COLUMN public.profiles.impulse_wait_hours     IS 'User rule: hours to wait before completing a discretionary purchase above impulse_wait_threshold.';
COMMENT ON COLUMN public.profiles.daily_sps_floor        IS 'User rule: minimum daily safe-to-spend the user wants to maintain through the month (₹).';
