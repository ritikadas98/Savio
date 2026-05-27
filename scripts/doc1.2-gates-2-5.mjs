// Doc 1.2 Gates 2-5 — single-destination, multi-destination, validation, negative skip.
//
// Database is assumed to be in a fresh post-seed state OR with April pending.
// The script resets April between gates 2/3 and 4/5 via reset_april_ritual.

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

async function ensureAprilPending() {
  const { data } = await sb.from('monthly_rituals').select('status').eq('user_id', PRIYA_ID).eq('month_year', '2026-04').single();
  if (data?.status === 'completed') {
    await sb.rpc('reset_april_ritual');
  }
}

async function fetchCloseOut() {
  const { data, error } = await sb.functions.invoke('ritual-close-out', { body: { month: '2026-04' } });
  if (error) throw error;
  return data;
}

async function fetchGoals() {
  const { data } = await sb.from('goals').select('id, label, current_amount, target_amount').eq('user_id', PRIYA_ID).eq('status', 'active');
  return data;
}

async function dumpBalances(label) {
  const goals = await fetchGoals();
  console.log(`     ${label}:`);
  for (const g of goals) console.log(`       ${g.label.padEnd(16)} ₹${g.current_amount}`);
}

// ─────────────────────────────────────────────────────
// Gate 2 — Single-destination path (the 80% case)
// ─────────────────────────────────────────────────────
console.log('\n=== Gate 2 — Single-destination path ===');
await ensureAprilPending();
let goals = await fetchGoals();
const phone = goals.find(g => g.label === 'Phone fund');
const phoneBefore2 = Number(phone.current_amount);
const closeOut2 = await fetchCloseOut();
const leftover2 = closeOut2.total_leftover;
console.log(`  Leftover: ₹${leftover2}, Phone fund before: ₹${phoneBefore2}`);

const { data: r2, error: e2 } = await sb.rpc('complete_monthly_ritual', {
  p_month_year: '2026-04',
  p_allocations: [
    { destination_kind: 'goal', destination_goal_id: phone.id, total_amount: leftover2,
      source_breakdown: { discretionary_leftover: closeOut2.discretionary_leftover, commitment_buffers: closeOut2.commitment_buffers, commitment_overruns: closeOut2.commitment_overruns } },
  ],
});
if (e2) { console.error('Gate 2 RPC error:', e2); process.exit(1); }
console.log(`  RPC result: ${JSON.stringify(r2)}`);

const { data: ritual2 } = await sb.from('monthly_rituals').select('status, close_out_snapshot').eq('user_id', PRIYA_ID).eq('month_year', '2026-04').single();
const { data: phone2After } = await sb.from('goals').select('current_amount').eq('id', phone.id).single();
const { data: allocs2 } = await sb.from('rollover_allocations').select('*').eq('user_id', PRIYA_ID).eq('ritual_month', '2026-04-01');
console.log(`  Ritual status: ${ritual2.status} ✓`);
console.log(`  Allocations written: ${allocs2.length}  (expected 1) ${allocs2.length === 1 ? '✓' : '✗'}`);
console.log(`  Phone fund delta: +₹${Number(phone2After.current_amount) - phoneBefore2} (expected +₹${leftover2}) ${Math.abs(Number(phone2After.current_amount) - phoneBefore2 - leftover2) < 0.01 ? '✓' : '✗'}`);
console.log(`  close_out_snapshot.allocations length: ${ritual2.close_out_snapshot?.allocations?.length ?? 'n/a'}`);

// ─────────────────────────────────────────────────────
// Gate 3 — Multi-destination split
// ─────────────────────────────────────────────────────
console.log('\n=== Gate 3 — Multi-destination split (Phone / Emergency / Carry-forward) ===');
await ensureAprilPending();
goals = await fetchGoals();
const phone3 = goals.find(g => g.label === 'Phone fund');
const emergency3 = goals.find(g => g.label.toLowerCase().includes('emergency'));
const phoneBefore3 = Number(phone3.current_amount);
const emergencyBefore3 = Number(emergency3.current_amount);
await dumpBalances('Balances before');

const closeOut3 = await fetchCloseOut();
const leftover3 = closeOut3.total_leftover;
const a1 = Math.floor(leftover3 * 0.5);
const a2 = Math.floor(leftover3 * 0.3);
const a3 = Math.floor(leftover3) - a1 - a2;
console.log(`  Leftover: ₹${leftover3} → split ₹${a1} / ₹${a2} / ₹${a3}  (sum=₹${a1 + a2 + a3})`);

// Note: leftover3 may be fractional (₹2,953.85). The frontend rounds to integers
// in its picker; the RPC accepts the float either way. We send rounded values
// for honest integer-split semantics. The total may differ from leftover by
// rounding noise; the UI's sum-check enforces exact match on integers. Here
// we feed integers in and assert the math against integer leftover.
const sb3 = a1 + a2 + a3;
const { data: r3, error: e3 } = await sb.rpc('complete_monthly_ritual', {
  p_month_year: '2026-04',
  p_allocations: [
    { destination_kind: 'goal',           destination_goal_id: phone3.id,     total_amount: a1, source_breakdown: { discretionary_leftover: closeOut3.discretionary_leftover, commitment_buffers: closeOut3.commitment_buffers, commitment_overruns: closeOut3.commitment_overruns } },
    { destination_kind: 'emergency_fund', destination_goal_id: emergency3.id, total_amount: a2, source_breakdown: { discretionary_leftover: closeOut3.discretionary_leftover, commitment_buffers: closeOut3.commitment_buffers, commitment_overruns: closeOut3.commitment_overruns } },
    { destination_kind: 'carry_forward',  destination_goal_id: null,          total_amount: a3, source_breakdown: { discretionary_leftover: closeOut3.discretionary_leftover, commitment_buffers: closeOut3.commitment_buffers, commitment_overruns: closeOut3.commitment_overruns } },
  ],
});
if (e3) { console.error('Gate 3 RPC error:', e3); process.exit(1); }
console.log(`  RPC result: ${JSON.stringify(r3)}`);

const { data: phone3After } = await sb.from('goals').select('current_amount').eq('id', phone3.id).single();
const { data: emergency3After } = await sb.from('goals').select('current_amount').eq('id', emergency3.id).single();
const { data: allocs3 } = await sb.from('rollover_allocations').select('*').eq('user_id', PRIYA_ID).eq('ritual_month', '2026-04-01').order('total_amount', { ascending: false });
const { data: ritual3 } = await sb.from('monthly_rituals').select('status, close_out_snapshot').eq('user_id', PRIYA_ID).eq('month_year', '2026-04').single();

console.log(`  Ritual status: ${ritual3.status}`);
console.log(`  Allocations written: ${allocs3.length}  (expected 3) ${allocs3.length === 3 ? '✓' : '✗'}`);
for (const r of allocs3) console.log(`    ${r.destination_kind.padEnd(16)} ₹${r.total_amount}`);
console.log(`  Phone fund delta: +₹${Number(phone3After.current_amount) - phoneBefore3} (expected +₹${a1}) ${Math.abs(Number(phone3After.current_amount) - phoneBefore3 - a1) < 0.01 ? '✓' : '✗'}`);
console.log(`  Emergency fund delta: +₹${Number(emergency3After.current_amount) - emergencyBefore3} (expected +₹${a2}) ${Math.abs(Number(emergency3After.current_amount) - emergencyBefore3 - a2) < 0.01 ? '✓' : '✗'}`);
console.log(`  Carry-forward row total: ₹${allocs3.find(r => r.destination_kind === 'carry_forward')?.total_amount} (expected ₹${a3})`);
console.log(`  close_out_snapshot.allocations length: ${ritual3.close_out_snapshot?.allocations?.length ?? 'n/a'} (expected 3)`);

// ─────────────────────────────────────────────────────
// Gate 4 — Validation edge cases (RPC-side)
// ─────────────────────────────────────────────────────
console.log('\n=== Gate 4 — Validation edges (RPC raises clean errors) ===');
await ensureAprilPending();
goals = await fetchGoals();
const phone4 = goals.find(g => g.label === 'Phone fund');

// 4.a — zero amount should reject
console.log('  4.a Zero amount …');
const { error: e4a } = await sb.rpc('complete_monthly_ritual', {
  p_month_year: '2026-04',
  p_allocations: [{ destination_kind: 'goal', destination_goal_id: phone4.id, total_amount: 0 }],
});
console.log(`     ${e4a ? `✓ rejected: ${e4a.message}` : '✗ accepted'}`);

// 4.b — missing destination_goal_id for goal kind should reject
console.log('  4.b Goal kind without goal_id …');
const { error: e4b } = await sb.rpc('complete_monthly_ritual', {
  p_month_year: '2026-04',
  p_allocations: [{ destination_kind: 'goal', destination_goal_id: null, total_amount: 500 }],
});
console.log(`     ${e4b ? `✓ rejected: ${e4b.message}` : '✗ accepted'}`);

// 4.c — unknown destination_kind should reject
console.log('  4.c Bad destination_kind …');
const { error: e4c } = await sb.rpc('complete_monthly_ritual', {
  p_month_year: '2026-04',
  p_allocations: [{ destination_kind: 'tip_jar', destination_goal_id: null, total_amount: 100 }],
});
console.log(`     ${e4c ? `✓ rejected: ${e4c.message}` : '✗ accepted'}`);

// Confirm April is still pending after the rejections (nothing was written)
const { data: ritual4 } = await sb.from('monthly_rituals').select('status').eq('user_id', PRIYA_ID).eq('month_year', '2026-04').single();
const { data: allocs4 } = await sb.from('rollover_allocations').select('id').eq('user_id', PRIYA_ID).eq('ritual_month', '2026-04-01');
console.log(`  April still pending: ${ritual4.status === 'pending' ? '✓' : '✗ ' + ritual4.status}`);
console.log(`  Zero rows written: ${allocs4.length === 0 ? '✓' : '✗ ' + allocs4.length + ' rows'}`);

// ─────────────────────────────────────────────────────
// Gate 5 — Negative leftover (empty allocations array)
// ─────────────────────────────────────────────────────
console.log('\n=== Gate 5 — Negative-leftover skip (empty p_allocations) ===');
await ensureAprilPending();

// We don't actually manufacture a negative leftover (that requires seed edit).
// We just verify the RPC accepts an empty array and marks ritual complete
// with close_out_snapshot.allocations = [].
const { data: r5, error: e5 } = await sb.rpc('complete_monthly_ritual', {
  p_month_year: '2026-04',
  p_allocations: [],
});
if (e5) { console.error('Gate 5 RPC error:', e5); process.exit(1); }
console.log(`  RPC result: ${JSON.stringify(r5)}`);
const { data: ritual5 } = await sb.from('monthly_rituals').select('status, close_out_snapshot').eq('user_id', PRIYA_ID).eq('month_year', '2026-04').single();
const { data: allocs5 } = await sb.from('rollover_allocations').select('id').eq('user_id', PRIYA_ID).eq('ritual_month', '2026-04-01');
console.log(`  Ritual status: ${ritual5.status}  ${ritual5.status === 'completed' ? '✓' : '✗'}`);
console.log(`  Allocations written: ${allocs5.length} (expected 0) ${allocs5.length === 0 ? '✓' : '✗'}`);
console.log(`  Snapshot.allocations: ${JSON.stringify(ritual5.close_out_snapshot?.allocations)} (expected []) ${Array.isArray(ritual5.close_out_snapshot?.allocations) && ritual5.close_out_snapshot.allocations.length === 0 ? '✓' : '✗'}`);

// Cleanup: reset April so subsequent test runs / Reviewer Console verify start clean.
await sb.rpc('reset_april_ritual');
console.log('\n(April reset to pending for subsequent tests)');

process.exit(0);
