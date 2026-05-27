// Phase 3 Doc 1 — end-to-end ritual walk-through.
// Updated by Doc 1.2 to use the new 2-arg complete_monthly_ritual signature
// (p_month_year, p_allocations jsonb array) and to look up allocations by
// ritual_month rather than the dropped monthly_rituals.rollover_allocation_id FK.

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
  console.log('\n[Negative-leftover branch] Calling complete with empty allocations…');
  const { data: skipRes, error } = await sb.rpc('complete_monthly_ritual', {
    p_month_year: '2026-04',
    p_allocations: [],
  });
  if (error) { console.error('RPC error:', error); process.exit(1); }
  console.log(`Skip result: ${JSON.stringify(skipRes)}`);
} else {
  console.log('\n=== Step 3 — pick destination (Phone fund, single allocation) ===');
  const { data: goals } = await sb.from('goals').select('*').eq('user_id', PRIYA_ID).eq('status', 'active');
  const phoneFund = goals.find(g => g.label.toLowerCase().includes('phone'));
  if (!phoneFund) { console.error('No Phone fund goal'); process.exit(1); }
  const phoneFundBefore = Number(phoneFund.current_amount);
  console.log(`Phone fund before: ₹${phoneFundBefore.toLocaleString('en-IN')} of ₹${Number(phoneFund.target_amount).toLocaleString('en-IN')}`);

  console.log('\n=== Step 4 — RPC: complete_monthly_ritual (single allocation) ===');
  const { data: rpcRes, error: rpcErr } = await sb.rpc('complete_monthly_ritual', {
    p_month_year: '2026-04',
    p_allocations: [
      {
        destination_kind: 'goal',
        destination_goal_id: phoneFund.id,
        total_amount: closeOut.total_leftover,
        source_breakdown: {
          discretionary_leftover: closeOut.discretionary_leftover,
          commitment_buffers: closeOut.commitment_buffers,
          commitment_overruns: closeOut.commitment_overruns,
        },
      },
    ],
  });
  if (rpcErr) { console.error('RPC error:', rpcErr); process.exit(1); }
  console.log(`RPC result: ${JSON.stringify(rpcRes)}`);
  const allocationIds = rpcRes.allocation_ids ?? [];
  console.log(`Allocations written: ${rpcRes.allocations_written}  IDs: [${allocationIds.join(', ')}]`);

  console.log('\n=== Step 5 — verify writes ===');
  const { data: postRitual } = await sb.from('monthly_rituals').select('*').eq('user_id', PRIYA_ID).eq('month_year', '2026-04').single();
  console.log(`April ritual: status=${postRitual.status}, completed_at set=${postRitual.completed_at != null}, snapshot present=${postRitual.close_out_snapshot != null}`);
  console.log(`Snapshot.allocations length: ${Array.isArray(postRitual.close_out_snapshot?.allocations) ? postRitual.close_out_snapshot.allocations.length : 'not-an-array'}`);

  const { data: phoneFundAfter } = await sb.from('goals').select('current_amount').eq('id', phoneFund.id).single();
  console.log(`Phone fund after: ₹${Number(phoneFundAfter.current_amount).toLocaleString('en-IN')} (delta +₹${(Number(phoneFundAfter.current_amount) - phoneFundBefore).toLocaleString('en-IN')})`);

  const { data: allocRows } = await sb.from('rollover_allocations').select('*').eq('user_id', PRIYA_ID).eq('ritual_month', '2026-04-01');
  console.log(`rollover_allocations rows for April: ${allocRows.length}`);
  for (const r of allocRows) {
    console.log(`  total=₹${r.total_amount}, destination_kind=${r.destination_kind}, ritual_month=${r.ritual_month}`);
  }
}

console.log('\n=== Step 6 — home state post-ritual ===');
const { data: post } = await sb.from('monthly_rituals').select('*').eq('user_id', PRIYA_ID).eq('status', 'pending').maybeSingle();
console.log('Pending ritual now:', post ? `${post.month_year}` : 'none ✓ (banner will hide)');

console.log('\nTo reset: node scripts/apply-migrations.js (or call reset_april_ritual via Reviewer Console)');
process.exit(0);
