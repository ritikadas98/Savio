// Phase 3 Doc 1 — end-to-end ritual walk-through.
// Simulates: user lands on home → April ritual pending → close-out fetch →
// pick destination → confirm RPC → ritual completed → home banner gone +
// safe-to-spend reflects carry-forward (if that's the destination).

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data: signIn, error: signErr } = await sb.auth.signInWithPassword({
  email: 'priya@savio.demo',
  password: process.env.DEMO_PRIYA_PASSWORD,
});
if (signErr) { console.error('Sign-in failed:', signErr.message); process.exit(1); }

const { data: profile } = await sb.from('profiles').select('id, monthly_income_net').eq('auth_user_id', signIn.user.id).single();
const PRIYA_ID = profile.id;

console.log('=== Step 1 — initial home state (pre-ritual) ===');
const { data: pre } = await sb.from('monthly_rituals').select('*').eq('user_id', PRIYA_ID).eq('status', 'pending').maybeSingle();
console.log('Pending ritual:', pre ? `${pre.month_year} (status=${pre.status})` : 'none');

console.log('\n=== Step 2 — invoke ritual-close-out for April ===');
const { data: closeOut } = await sb.functions.invoke('ritual-close-out', { body: { month: '2026-04' } });
if (closeOut?.error) { console.error('CloseOut error:', closeOut.error); process.exit(1); }
console.log(`total_leftover: ₹${closeOut.total_leftover.toLocaleString('en-IN')}`);
console.log(`discretionary_leftover: ₹${closeOut.discretionary_leftover.toLocaleString('en-IN')}`);
console.log(`buffers: ${closeOut.commitment_buffers.length}, overruns: ${closeOut.commitment_overruns.length}`);

if (closeOut.total_leftover <= 0) {
  console.log('\n[Negative-leftover branch] Confirming skip-rollover…');
  const { error } = await sb.rpc('complete_monthly_ritual', {
    p_month_year: '2026-04', p_skip_rollover: true,
    p_source_breakdown: null, p_total_amount: null,
    p_destination_kind: null, p_destination_goal_id: null,
    p_close_out_snapshot: closeOut,
  });
  if (error) { console.error('RPC error:', error); process.exit(1); }
  console.log('Ritual completed (no rollover).');
} else {
  console.log('\n=== Step 3 — pick destination (Phone fund) ===');
  const { data: goals } = await sb.from('goals').select('*').eq('user_id', PRIYA_ID).eq('status', 'active');
  const phoneFund = goals.find(g => g.label.toLowerCase().includes('phone'));
  if (!phoneFund) { console.error('No Phone fund goal'); process.exit(1); }
  const phoneFundBefore = Number(phoneFund.current_amount);
  console.log(`Phone fund before: ₹${phoneFundBefore.toLocaleString('en-IN')} of ₹${Number(phoneFund.target_amount).toLocaleString('en-IN')}`);

  console.log('\n=== Step 4 — RPC: complete_monthly_ritual ===');
  const { data: rolloverId, error: rpcErr } = await sb.rpc('complete_monthly_ritual', {
    p_month_year: '2026-04',
    p_skip_rollover: false,
    p_source_breakdown: {
      discretionary_leftover: closeOut.discretionary_leftover,
      commitment_buffers: closeOut.commitment_buffers,
      commitment_overruns: closeOut.commitment_overruns,
    },
    p_total_amount: closeOut.total_leftover,
    p_destination_kind: 'goal',
    p_destination_goal_id: phoneFund.id,
    p_close_out_snapshot: closeOut,
  });
  if (rpcErr) { console.error('RPC error:', rpcErr); process.exit(1); }
  console.log(`RPC succeeded — rollover_allocation_id = ${rolloverId}`);

  console.log('\n=== Step 5 — verify writes ===');
  const { data: postRitual } = await sb.from('monthly_rituals').select('*').eq('user_id', PRIYA_ID).eq('month_year', '2026-04').single();
  console.log(`April ritual status: ${postRitual.status}, completed_at: ${postRitual.completed_at != null}, rollover_id set: ${postRitual.rollover_allocation_id === rolloverId}, snapshot present: ${postRitual.close_out_snapshot != null}`);

  const { data: phoneFundAfter } = await sb.from('goals').select('current_amount').eq('id', phoneFund.id).single();
  console.log(`Phone fund after: ₹${Number(phoneFundAfter.current_amount).toLocaleString('en-IN')} (delta +₹${(Number(phoneFundAfter.current_amount) - phoneFundBefore).toLocaleString('en-IN')})`);

  const { data: rolloverRow } = await sb.from('rollover_allocations').select('*').eq('id', rolloverId).single();
  console.log(`Rollover row: total=₹${rolloverRow.total_amount}, destination_kind=${rolloverRow.destination_kind}, ritual_month=${rolloverRow.ritual_month}`);
}

console.log('\n=== Step 6 — home state post-ritual ===');
const { data: post } = await sb.from('monthly_rituals').select('*').eq('user_id', PRIYA_ID).eq('status', 'pending').maybeSingle();
console.log('Pending ritual now:', post ? `${post.month_year}` : 'none ✓ (banner will hide)');

console.log('\n=== Step 7 — reset for next demo run ===');
await sb.rpc('complete_monthly_ritual', {
  // Roundtripping won't work for reset — we just want to verify the walkthrough.
  // For an actual reset, run scripts/apply-migrations.js.
  p_month_year: '__noop__', p_skip_rollover: true, p_source_breakdown: null, p_total_amount: null,
  p_destination_kind: null, p_destination_goal_id: null, p_close_out_snapshot: null,
}).catch(() => null);  // expected to error (no such month_year); just demonstrating
console.log('To reset: node scripts/apply-migrations.js');

process.exit(0);
