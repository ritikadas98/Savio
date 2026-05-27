-- 0016_saved_decisions_structured.sql
--
-- Phase C3 — extend saved_decisions to hold the full structured verdict.
--
-- Pre-flight (Section 5) confirmed:
--   - chat_messages already has ai_metadata JSONB (migration 0005) — that's
--     where {kind, structured} lives on the message side. No change there.
--   - saved_decisions has decision_text TEXT (prose snippet) but nowhere to
--     stash the full verdict tuple {verdict_color, verdict_line, body,
--     tradeoffs[], best_next_step}.
--
-- This migration adds a single nullable JSONB column. NULL for prose-saved
-- decisions (existing pattern); populated for structured-verdict saves.
-- The existing `verdict` text column stays as the green/amber/red enum
-- (PM_DECISIONS.C.8 maps GREEN→green, YELLOW→amber, RED→red).

ALTER TABLE public.saved_decisions
  ADD COLUMN IF NOT EXISTS decision_data jsonb;

COMMENT ON COLUMN public.saved_decisions.decision_data IS
  'Structured verdict payload when applicable: {verdict_color, verdict_line, body, tradeoffs[], best_next_step}. NULL for prose-only saves.';
