// Reviewer Console RPC client helpers.
// Three thin wrappers around the supabase.rpc() calls defined in
// supabase/migrations/0010_reviewer_console_rpcs.sql.
//
// Each helper returns the JSON result the RPC produces:
//   { status, message, ...optional fields per action }
//
// Errors thrown by the RPC (e.g. "No profile found for current user")
// bubble up as exceptions; callers should catch and surface inline.

import { supabase } from './supabase';

export type ReviewerActionResult = {
  status: string;
  message: string;
  [k: string]: unknown;
};

export async function resetAprilRitual(): Promise<ReviewerActionResult> {
  const { data, error } = await supabase.rpc('reset_april_ritual');
  if (error) throw error;
  return data as ReviewerActionResult;
}

export async function clearChatHistory(): Promise<ReviewerActionResult> {
  const { data, error } = await supabase.rpc('clear_chat_history');
  if (error) throw error;
  return data as ReviewerActionResult;
}

export async function resetReflectionsToSeed(): Promise<ReviewerActionResult> {
  const { data, error } = await supabase.rpc('reset_reflections_to_seed');
  if (error) throw error;
  // Stream 0.5j — reset bypasses the label-tap path that normally invalidates,
  // so we explicitly clear the cache here. Otherwise post-reset patterns
  // would be stale until the cache TTL expired.
  await supabase.rpc('invalidate_patterns_cache').catch(() => { /* non-fatal */ });
  return data as ReviewerActionResult;
}

// Stream 0.5j-fix — force a fresh AI synthesis, bypassing the 24-hour cache.
// Calls the Edge Function with `force_refresh: true`, which already supports
// this flag (verified by phase05j-ai-check.mjs).
//
// 0.5j-fix2 — the affordance moved from Reviewer Console to a ↻ button in the
// Reflect page header, so the helper now returns the patterns + source on top
// of the original message field. The status/message fields are preserved for
// any future surface that wants the structured-result UX; the new fields let
// the Reflect caller update state directly without a second invoke.
export type ForceResynthesizeResult = ReviewerActionResult & {
  patterns?: Array<{ label: string; body: string; source_aggregates?: string[] }>;
  source?: 'ai' | 'rule_engine';
  latency_ms?: number;
};

export async function forceResynthesizePatterns(): Promise<ForceResynthesizeResult> {
  const { data, error } = await supabase.functions.invoke('synthesize-patterns', {
    body: { force_refresh: true },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  const patterns = Array.isArray(data?.patterns) ? data.patterns : [];
  const latency = typeof data?.latency_ms === 'number' ? data.latency_ms : undefined;
  return {
    status: 'resynthesized',
    message: `Patterns re-synthesized — ${patterns.length} found${latency != null ? ` in ${latency}ms` : ''}.`,
    patterns,
    source: data?.source === 'ai' ? 'ai' : 'rule_engine',
    latency_ms: latency,
  };
}
