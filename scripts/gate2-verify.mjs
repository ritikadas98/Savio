// Phase 3 Doc 1 — Gate 2 verification.
// Invokes the deployed ritual-close-out Edge Function as Priya, validates the
// returned shape, and prints the numbers so we can sanity-check against the
// Gate 0/1 SQL output.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data: signIn, error: signErr } = await sb.auth.signInWithPassword({
  email: 'priya@savio.demo',
  password: process.env.DEMO_PRIYA_PASSWORD,
});
if (signErr) { console.error('Sign-in failed:', signErr.message); process.exit(1); }
console.log(`Signed in as ${signIn.user.email}`);

const month = '2026-04';
console.log(`\nInvoking ritual-close-out with month=${month}…`);
const start = Date.now();
const { data, error } = await sb.functions.invoke('ritual-close-out', { body: { month } });
const elapsed = Date.now() - start;
if (error) { console.error('Function error:', error.message); process.exit(1); }
if (data?.error) { console.error('Function returned error:', data.error); process.exit(1); }

console.log(`Wall time: ${elapsed}ms`);
console.log(`\n=== Close-out summary for ${data.month} ===`);
console.log(`Total leftover:         ₹${data.total_leftover.toLocaleString('en-IN')}`);
console.log(`Discretionary leftover: ₹${data.discretionary_leftover.toLocaleString('en-IN')}`);

console.log(`\nCommitment overruns (${data.commitment_overruns.length}):`);
for (const o of data.commitment_overruns) {
  console.log(`  ${o.commitment_name.padEnd(14)} budgeted=₹${o.budgeted}  actual=₹${o.actual.toFixed(2)}  overrun=−₹${o.overrun.toFixed(2)}`);
}

console.log(`\nCommitment buffers (${data.commitment_buffers.length}):`);
for (const b of data.commitment_buffers) {
  console.log(`  ${b.commitment_name.padEnd(14)} budgeted=₹${b.budgeted}  actual=₹${b.actual.toFixed(2)}  buffer=+₹${b.buffer.toFixed(2)}`);
}

console.log(`\nUnlabeled transactions (${data.unlabeled_transactions.length}):`);
for (const t of data.unlabeled_transactions) {
  console.log(`  ${(t.merchant ?? 'Unknown').padEnd(15)} ₹${Number(t.amount).toLocaleString('en-IN')}  ${t.occurred_at.slice(0,10)}  [${t.category ?? 'no-category'}]`);
}

console.log(`\nReconciliation: discretionary + buffers − overruns =`);
const sumBuf = data.commitment_buffers.reduce((s, b) => s + b.buffer, 0);
const sumOv = data.commitment_overruns.reduce((s, o) => s + o.overrun, 0);
const computed = data.discretionary_leftover + sumBuf - sumOv;
console.log(`  ${data.discretionary_leftover.toFixed(2)} + ${sumBuf.toFixed(2)} − ${sumOv.toFixed(2)} = ${computed.toFixed(2)}`);
console.log(`  vs total_leftover: ${data.total_leftover.toFixed(2)}  → ${Math.abs(computed - data.total_leftover) < 0.01 ? 'MATCH ✓' : 'MISMATCH ✗'}`);

process.exit(0);
