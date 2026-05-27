-- 0015_reflection_patterns_cache.sql
--
-- Phase 3 Stream 0.5j — AI-Powered Reflect Patterns.
--
-- Vertex AI synthesis takes 2-5s per call. Calling on every Reflect page
-- mount would be expensive (latency + token cost). Cache per-user, 24h
-- expiry, invalidated whenever a reflection is added/removed/reset.
--
-- Pattern source ('ai' | 'rule_engine') is captured so the frontend can
-- show the ✨ sparkles affordance only when patterns are AI-synthesized.
-- A rule-engine cached entry means a prior AI call failed and we cached
-- the fallback so we don't retry the AI on every page load — the cache
-- is invalidated naturally when the user labels a new reflection.

CREATE TABLE IF NOT EXISTS public.reflection_patterns_cache (
  user_id      uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  patterns     jsonb NOT NULL,
  source       text  NOT NULL CHECK (source IN ('ai', 'rule_engine')),
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

ALTER TABLE public.reflection_patterns_cache ENABLE ROW LEVEL SECURITY;

-- RLS: a user can read/write their own cache row. Pattern matches RLS in
-- 0007_fix_rls_policies.sql — JOIN through profiles on auth_user_id.
DROP POLICY IF EXISTS rpc_select_own ON public.reflection_patterns_cache;
CREATE POLICY rpc_select_own ON public.reflection_patterns_cache
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = reflection_patterns_cache.user_id
        AND profiles.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS rpc_insert_own ON public.reflection_patterns_cache;
CREATE POLICY rpc_insert_own ON public.reflection_patterns_cache
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = reflection_patterns_cache.user_id
        AND profiles.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS rpc_update_own ON public.reflection_patterns_cache;
CREATE POLICY rpc_update_own ON public.reflection_patterns_cache
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = reflection_patterns_cache.user_id
        AND profiles.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS rpc_delete_own ON public.reflection_patterns_cache;
CREATE POLICY rpc_delete_own ON public.reflection_patterns_cache
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = reflection_patterns_cache.user_id
        AND profiles.auth_user_id = auth.uid()
    )
  );

-- Convenience RPC the frontend uses to invalidate cache after a reflection
-- label / undo / reset. SECURITY DEFINER so caller never needs to know the
-- profile.id — resolves it from auth.uid().
CREATE OR REPLACE FUNCTION public.invalidate_patterns_cache()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_deleted    int;
BEGIN
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found for auth user %', auth.uid();
  END IF;

  WITH d AS (
    DELETE FROM public.reflection_patterns_cache WHERE user_id = v_profile_id RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted FROM d;

  RETURN jsonb_build_object('status', 'invalidated', 'deleted_count', v_deleted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.invalidate_patterns_cache() TO authenticated;
