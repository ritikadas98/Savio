// Shared snapshot/restore helper for verification scripts that need to call
// clear_chat_history() between test iterations. Pre-Phase-D-followup these
// scripts wiped Priya's chat as a side effect — a portfolio reviewer who
// chatted and then someone ran regression would lose their conversation.
//
// Usage:
//   const restore = await snapshotChat(sb, profile.id);
//   try {
//     // ... test body that calls clear_chat_history() freely
//   } finally {
//     await restore();
//   }
//
// Implementation note: we snapshot the full row (including `id`) so that
// `saved_decisions.related_message_id` FKs survive the round-trip. Re-insert
// uses the same primary-key UUIDs the snapshot captured.

export async function snapshotChat(sb, profileId) {
  const { data, error } = await sb
    .from('chat_messages')
    .select('id, user_id, role, content, ai_metadata, created_at')
    .eq('user_id', profileId);
  if (error) {
    console.warn('[chat-snapshot] read failed (will skip restore):', error.message);
    return async () => {};
  }
  const rows = data ?? [];
  return async function restore() {
    // Wipe any test residue first. supabase-js v2 rpc() returns a
    // PostgrestBuilder (PromiseLike), not a real Promise — no `.catch()`,
    // so we await and inspect `error` explicitly.
    try {
      await sb.rpc('clear_chat_history');
    } catch (e) {
      console.warn('[chat-snapshot] clear failed (continuing):', e?.message ?? e);
    }
    if (rows.length === 0) return;
    // Re-insert preserving original IDs so any FKs survive
    const { error: insErr } = await sb.from('chat_messages').insert(rows);
    if (insErr) {
      console.warn('[chat-snapshot] restore failed:', insErr.message);
      return;
    }
    console.log(`[chat-snapshot] restored ${rows.length} chat row(s)`);
  };
}
