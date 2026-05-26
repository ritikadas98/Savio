// Phase 3.5 — Reviewer Console verification.
// Behavior tests for all three RPCs against the deployed DB.

import { createClient } from '@supabase/supabase-js';
import { Client as PgClient } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data: signIn, error: signErr } = await sb.auth.signInWithPassword({
  email: 'priya@savio.demo',
  password: process.env.DEMO_PRIYA_PASSWORD,
});
if (signErr) { console.error('Sign-in failed:', signErr.message); process.exit(1); }
const { data: profile } = await sb.from('profiles').select('id').eq('auth_user_id', signIn.user.id).single();
const PRIYA_ID = profile.id;

const pg = new PgClient({ connectionString: process.env.DATABASE_URL });
await pg.connect();

console.log('\n=== Gate 1.a — RPCs exist ===');
const fns = await pg.query(`SELECT proname FROM pg_proc WHERE proname IN ('reset_april_ritual','clear_chat_history','reset_reflections_to_seed') ORDER BY proname`);
for (const r of fns.rows) console.log(`  ✓ ${r.proname}`);
if (fns.rows.length !== 3) { console.error('Expected 3 RPCs'); process.exit(1); }

console.log('\n=== Gate 1.b — Snapshot populated ===');
const snap = await pg.query(`SELECT COUNT(*)::int AS n FROM reflections_seed_snapshot WHERE user_id = $1`, [PRIYA_ID]);
const refl = await pg.query(`SELECT COUNT(*)::int AS n FROM reflections WHERE user_id = $1`, [PRIYA_ID]);
console.log(`  reflections: ${refl.rows[0].n}, snapshot: ${snap.rows[0].n}  ${refl.rows[0].n === snap.rows[0].n ? '✓' : '✗ MISMATCH'}`);

// ─────────────────────────────────────────────────────
// Gate 2 — Reset April ritual
// ─────────────────────────────────────────────────────
console.log('\n=== Gate 2 — Reset April ritual ===');

// First: idempotency check. April is currently pending (fresh seed).
console.log('  2.a Calling reset_april_ritual() when April is already pending…');
let { data: r1 } = await sb.rpc('reset_april_ritual');
console.log(`     → status=${r1.status}, message="${r1.message}"`);
if (r1.status !== 'already_pending') { console.error(`Expected already_pending, got ${r1.status}`); process.exit(1); }

// Now complete the April ritual via the existing RPC, then reset
console.log('  2.b Completing April ritual → Phone fund …');
const { data: phoneBefore } = await sb.from('goals').select('id, label, current_amount').eq('user_id', PRIYA_ID).eq('label', 'Phone fund').single();
console.log(`     Phone fund before: ₹${phoneBefore.current_amount}`);

const { data: closeOut } = await sb.functions.invoke('ritual-close-out', { body: { month: '2026-04' } });
const totalToRoll = closeOut.total_leftover;
console.log(`     Closing out — total to roll: ₹${totalToRoll}`);

const { error: completeErr } = await sb.rpc('complete_monthly_ritual', {
  p_month_year: '2026-04', p_skip_rollover: false,
  p_source_breakdown: { discretionary_leftover: closeOut.discretionary_leftover, commitment_buffers: closeOut.commitment_buffers, commitment_overruns: closeOut.commitment_overruns },
  p_total_amount: totalToRoll, p_destination_kind: 'goal', p_destination_goal_id: phoneBefore.id,
  p_close_out_snapshot: closeOut,
});
if (completeErr) { console.error('complete_monthly_ritual:', completeErr); process.exit(1); }

const { data: phoneMid } = await sb.from('goals').select('current_amount').eq('id', phoneBefore.id).single();
console.log(`     Phone fund after rollover: ₹${phoneMid.current_amount} (delta +₹${Number(phoneMid.current_amount) - Number(phoneBefore.current_amount)})`);

const { data: ritualAfter } = await sb.from('monthly_rituals').select('status, rollover_allocation_id').eq('user_id', PRIYA_ID).eq('month_year', '2026-04').single();
console.log(`     Ritual status: ${ritualAfter.status}, has rollover: ${ritualAfter.rollover_allocation_id != null}`);

// Now reset
console.log('  2.c Calling reset_april_ritual() after completion…');
const { data: r2 } = await sb.rpc('reset_april_ritual');
console.log(`     → status=${r2.status}, reverted=₹${r2.reverted_amount}, goal=${r2.reverted_goal_name}`);

const { data: phoneFinal } = await sb.from('goals').select('current_amount').eq('id', phoneBefore.id).single();
console.log(`     Phone fund after reset: ₹${phoneFinal.current_amount}  ${Number(phoneFinal.current_amount) === Number(phoneBefore.current_amount) ? '✓ (reverted)' : '✗ (NOT reverted)'}`);

const { data: ritualFinal } = await sb.from('monthly_rituals').select('status, rollover_allocation_id, completed_at, close_out_snapshot').eq('user_id', PRIYA_ID).eq('month_year', '2026-04').single();
console.log(`     Ritual: status=${ritualFinal.status}, rollover_id=${ritualFinal.rollover_allocation_id}, completed_at=${ritualFinal.completed_at}, snapshot=${ritualFinal.close_out_snapshot}`);

const { data: allocs } = await sb.from('rollover_allocations').select('id').eq('user_id', PRIYA_ID);
console.log(`     rollover_allocations rows for user: ${allocs.length}  ${allocs.length === 0 ? '✓ (deleted)' : '✗'}`);

// ─────────────────────────────────────────────────────
// Gate 3 — Clear chat history
// ─────────────────────────────────────────────────────
console.log('\n=== Gate 3 — Clear chat history ===');

// Insert a test message first
await sb.from('chat_messages').insert([
  { user_id: PRIYA_ID, role: 'user', content: 'test message 1' },
  { user_id: PRIYA_ID, role: 'assistant', content: 'test response 1' },
]);
const { count: beforeCount } = await sb.from('chat_messages').select('*', { count: 'exact', head: true }).eq('user_id', PRIYA_ID);
console.log(`  Before clear: ${beforeCount} messages`);

const { data: clr } = await sb.rpc('clear_chat_history');
console.log(`  RPC → status=${clr.status}, deleted=${clr.deleted_count}, message="${clr.message}"`);

const { count: afterCount } = await sb.from('chat_messages').select('*', { count: 'exact', head: true }).eq('user_id', PRIYA_ID);
console.log(`  After clear: ${afterCount} messages  ${afterCount === 0 ? '✓' : '✗'}`);

// Idempotency
const { data: clr2 } = await sb.rpc('clear_chat_history');
console.log(`  Idempotency: status=${clr2.status}, deleted=${clr2.deleted_count}, message="${clr2.message}"`);

// ─────────────────────────────────────────────────────
// Gate 4 — Restore reflections to seed
// ─────────────────────────────────────────────────────
console.log('\n=== Gate 4 — Restore reflections to seed ===');

const { count: seedCount } = await sb.from('reflections').select('*', { count: 'exact', head: true }).eq('user_id', PRIYA_ID);
console.log(`  Seeded reflection count: ${seedCount}`);

// Add a fake reflection on the first NULL-reflected April transaction
const { data: candidate } = await sb.from('transactions')
  .select('id').eq('user_id', PRIYA_ID).gte('occurred_at', '2026-04-01').lt('occurred_at', '2026-05-01')
  .eq('direction', 'debit').is('commitment_id', null).gte('amount', 1500)
  .order('amount', { ascending: false }).limit(1).maybeSingle();
if (candidate) {
  await sb.from('reflections').insert({ user_id: PRIYA_ID, transaction_id: candidate.id, label: 'regret' });
  const { count: postAddCount } = await sb.from('reflections').select('*', { count: 'exact', head: true }).eq('user_id', PRIYA_ID);
  console.log(`  Added 1 reflection. Count: ${postAddCount}`);
}

const { data: restored } = await sb.rpc('reset_reflections_to_seed');
console.log(`  RPC → status=${restored.status}, deleted=${restored.deleted_count}, restored=${restored.restored_count}, message="${restored.message}"`);

const { count: finalCount } = await sb.from('reflections').select('*', { count: 'exact', head: true }).eq('user_id', PRIYA_ID);
console.log(`  After restore: ${finalCount}  ${finalCount === seedCount ? '✓ (matches seed)' : '✗'}`);

// Idempotency
const { data: restored2 } = await sb.rpc('reset_reflections_to_seed');
console.log(`  Idempotency: status=${restored2.status}, message="${restored2.message}"`);

await pg.end();
process.exit(0);
