// Doc 1.2 Gate 1 — schema + RPC signature verification + reset_april_ritual smoke.

import { createClient } from '@supabase/supabase-js';
import { Client as PgClient } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pg = new PgClient({ connectionString: process.env.DATABASE_URL });
await pg.connect();

console.log('\n=== Gate 1.a — monthly_rituals.rollover_allocation_id column dropped ===');
const col = await pg.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'monthly_rituals'
  ORDER BY ordinal_position`);
const colNames = col.rows.map(r => r.column_name);
const hasOldCol = colNames.includes('rollover_allocation_id');
console.log(`  monthly_rituals columns: ${colNames.join(', ')}`);
console.log(`  rollover_allocation_id present? ${hasOldCol ? '✗ (still there)' : '✓ (dropped)'}`);

console.log('\n=== Gate 1.b — new RPC signatures ===');
const sigs = await pg.query(`
  SELECT proname, pg_get_function_arguments(oid) AS args, pg_get_function_result(oid) AS ret
  FROM pg_proc WHERE proname IN ('complete_monthly_ritual','reset_april_ritual') ORDER BY proname`);
for (const r of sigs.rows) {
  console.log(`  ${r.proname}(${r.args}) -> ${r.ret}`);
}
const completeSig = sigs.rows.find(r => r.proname === 'complete_monthly_ritual');
const expectedComplete = 'p_month_year text, p_allocations jsonb';
console.log(`  complete_monthly_ritual matches "${expectedComplete}"? ${completeSig?.args === expectedComplete ? '✓' : '✗'}`);

console.log('\n=== Gate 1.c — reset_april_ritual idempotency (April pending after fresh seed) ===');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data: signIn, error: signErr } = await sb.auth.signInWithPassword({
  email: 'priya@savio.demo', password: process.env.DEMO_PRIYA_PASSWORD,
});
if (signErr) { console.error('Sign-in failed:', signErr.message); process.exit(1); }
const { data: profile } = await sb.from('profiles').select('id').eq('auth_user_id', signIn.user.id).single();
const PRIYA_ID = profile.id;

const { data: r1, error: e1 } = await sb.rpc('reset_april_ritual');
if (e1) { console.error('Reset error:', e1); process.exit(1); }
console.log(`  Pending April → reset_april_ritual() → status=${r1.status}, message="${r1.message}"`);
console.log(`  Expected status='already_pending'? ${r1.status === 'already_pending' ? '✓' : '✗'}`);

console.log('\n=== Gate 1.d — complete_monthly_ritual with single allocation, then reset ===');
const { data: phoneBefore } = await sb.from('goals').select('id, label, current_amount')
  .eq('user_id', PRIYA_ID).eq('label', 'Phone fund').single();
console.log(`  Phone fund before: ₹${phoneBefore.current_amount}`);

const closeOut = await sb.functions.invoke('ritual-close-out', { body: { month: '2026-04' } });
const total = closeOut.data.total_leftover;
console.log(`  Close-out total leftover: ₹${total}`);

const { data: completeRes, error: completeErr } = await sb.rpc('complete_monthly_ritual', {
  p_month_year: '2026-04',
  p_allocations: [
    {
      destination_kind: 'goal',
      destination_goal_id: phoneBefore.id,
      total_amount: total,
      source_breakdown: {
        discretionary_leftover: closeOut.data.discretionary_leftover,
        commitment_buffers: closeOut.data.commitment_buffers,
        commitment_overruns: closeOut.data.commitment_overruns,
      },
    },
  ],
});
if (completeErr) { console.error('Complete error:', completeErr); process.exit(1); }
console.log(`  RPC result: ${JSON.stringify(completeRes)}`);

const { data: phoneAfter } = await sb.from('goals').select('current_amount').eq('id', phoneBefore.id).single();
console.log(`  Phone fund after complete: ₹${phoneAfter.current_amount} (delta +₹${Number(phoneAfter.current_amount) - Number(phoneBefore.current_amount)})`);
console.log(`  Delta matches close-out? ${Math.abs(Number(phoneAfter.current_amount) - Number(phoneBefore.current_amount) - total) < 0.01 ? '✓' : '✗'}`);

const { data: r2, error: e2 } = await sb.rpc('reset_april_ritual');
if (e2) { console.error('Reset error:', e2); process.exit(1); }
console.log(`  Reset result: status=${r2.status}, count=${r2.reverted_count}, total=₹${r2.reverted_total}`);

const { data: phoneFinal } = await sb.from('goals').select('current_amount').eq('id', phoneBefore.id).single();
console.log(`  Phone fund after reset: ₹${phoneFinal.current_amount}  ${Number(phoneFinal.current_amount) === Number(phoneBefore.current_amount) ? '✓ reverted' : '✗ NOT reverted'}`);

const { data: ritualNow } = await sb.from('monthly_rituals').select('status, completed_at, close_out_snapshot')
  .eq('user_id', PRIYA_ID).eq('month_year', '2026-04').single();
console.log(`  April ritual: status=${ritualNow.status}, completed_at=${ritualNow.completed_at}, snapshot=${ritualNow.close_out_snapshot === null ? 'NULL ✓' : JSON.stringify(ritualNow.close_out_snapshot)}`);

const { data: allocsRemaining } = await sb.from('rollover_allocations').select('id').eq('user_id', PRIYA_ID).eq('ritual_month', '2026-04-01');
console.log(`  Remaining April rollover_allocations: ${allocsRemaining.length}  ${allocsRemaining.length === 0 ? '✓' : '✗'}`);

await pg.end();
process.exit(0);
