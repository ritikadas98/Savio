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
  return data as ReviewerActionResult;
}
