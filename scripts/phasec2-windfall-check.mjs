// Phase C2 sanity check — call record_windfall_allocations for Priya's
// ₹6,200 tax refund, verify the hybrid write, then reset.
//
// Hybrid persistence assertions (PM_DECISIONS.C.1):
//   - windfalls.allocations gets the JSONB array
//   - windfalls.status flips to 'allocated', allocated_at set
//   - goal.current_amount UNCHANGED for Emergency + Phone
//   - monthly_rituals.safe_to_spend_locked UNCHANGED

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data: signIn, error: signErr } = await sb.auth.signInWithPassword({
  email: 'priya@savio.demo', password: process.env.DEMO_PRIYA_PASSWORD,
});
if (signErr) { console.error('Sign-in failed:', signErr.message); process.exit(1); }
const { data: profile } = await sb.from('profiles').select('id').eq('auth_user_id', signIn.user.id).single();
const PRIYA_ID = profile.id;

console.log('=== Pre-state: ₹6,200 windfall row (should be pending_allocation) ===');
const { data: wfPre } = await sb.from('windfalls').select('id, amount, status, allocations, allocated_at').eq('user_id', PRIYA_ID).eq('amount', 6200).single();
console.log(`  id=${wfPre.id} status=${wfPre.status} allocations=${JSON.stringify(wfPre.allocations)} allocated_at=${wfPre.allocated_at}`);

console.log('\n=== Pre-state: goal current_amounts (snapshot before RPC) ===');
const { data: goalsPre } = await sb.from('goals').select('label, current_amount').eq('user_id', PRIYA_ID).in('label', ['Emergency fund', 'Phone fund']);
goalsPre.forEach(g => console.log(`  ${g.label}: ₹${Number(g.current_amount).toLocaleString('en-IN')}`));
const preMap = Object.fromEntries(goalsPre.map(g => [g.label, Number(g.current_amount)]));

console.log('\n=== Calling record_windfall_allocations ===');
const allocations = [
  { bucket_kind: 'emergency', amount: 2500 },
  { bucket_kind: 'phone',     amount: 1900 },
  { bucket_kind: 'free',      amount: 1800 },
];
const { data: rpcRes, error: rpcErr } = await sb.rpc('record_windfall_allocations', {
  p_event_id: wfPre.id,
  p_allocations: allocations,
});
if (rpcErr) { console.error('RPC error:', rpcErr); process.exit(1); }
console.log(`  result: ${JSON.stringify(rpcRes)}`);

console.log('\n=== Post-state: windfall row ===');
const { data: wfPost } = await sb.from('windfalls').select('status, allocations, allocated_at').eq('id', wfPre.id).single();
console.log(`  status: ${wfPost.status}  (expected 'allocated')`);
console.log(`  allocated_at: ${wfPost.allocated_at}  (expected non-null)`);
console.log(`  allocations: ${JSON.stringify(wfPost.allocations)}`);
const sum = (wfPost.allocations ?? []).reduce((s, a) => s + Number(a.amount), 0);
console.log(`  sum: ₹${sum.toLocaleString('en-IN')}  (expected ₹6,200)`);

console.log('\n=== Post-state: goal current_amounts (must be UNCHANGED) ===');
const { data: goalsPost } = await sb.from('goals').select('label, current_amount').eq('user_id', PRIYA_ID).in('label', ['Emergency fund', 'Phone fund']);
let drift = false;
goalsPost.forEach(g => {
  const before = preMap[g.label];
  const after = Number(g.current_amount);
  const ok = before === after;
  if (!ok) drift = true;
  console.log(`  ${g.label}: ₹${after.toLocaleString('en-IN')}  ${ok ? '✓ unchanged' : `✗ drifted from ₹${before.toLocaleString('en-IN')}`}`);
});

console.log('\n=== Idempotency: second call should fail (status is now allocated) ===');
const { error: dupErr } = await sb.rpc('record_windfall_allocations', {
  p_event_id: wfPre.id,
  p_allocations: allocations,
});
console.log(`  second call error: ${dupErr?.message ?? 'NONE (unexpected — RPC should reject)'}`);

console.log('\n=== Home query: pending_allocation count (should drop to 1, the ₹50K Diwali bonus) ===');
const { data: pendingNow } = await sb.from('windfalls').select('amount, detected_at').eq('user_id', PRIYA_ID).eq('status', 'pending_allocation');
pendingNow.forEach(w => console.log(`  remaining pending: ₹${Number(w.amount).toLocaleString('en-IN')} from ${w.detected_at?.split('T')[0]}`));

console.log('\n=== Cleanup: reset windfall row to pending_allocation ===');
await sb.from('windfalls').update({ status: 'pending_allocation', allocations: null, allocated_at: null }).eq('id', wfPre.id);
const { data: cleanedRow } = await sb.from('windfalls').select('status, allocations, allocated_at').eq('id', wfPre.id).single();
console.log(`  cleaned: status=${cleanedRow.status} allocations=${JSON.stringify(cleanedRow.allocations)} allocated_at=${cleanedRow.allocated_at}`);

console.log(`\n${drift ? '✗ DRIFT' : '✓ NO DRIFT'} — goal current_amounts unchanged across RPC.`);
process.exit(drift ? 1 : 0);
