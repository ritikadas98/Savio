// Doc 1.2 Gate 6 — Reviewer Console reset compatibility with multi-allocation ritual.
//
// Completes April with a 3-destination split, then resets via Reviewer Console
// and confirms all 3 destination balances reverted and all 3 allocation rows
// deleted.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data: signIn } = await sb.auth.signInWithPassword({ email: 'priya@savio.demo', password: process.env.DEMO_PRIYA_PASSWORD });
const { data: profile } = await sb.from('profiles').select('id').eq('auth_user_id', signIn.user.id).single();
const PRIYA_ID = profile.id;

// Make sure April is pending to start.
const { data: ritualStart } = await sb.from('monthly_rituals').select('status').eq('user_id', PRIYA_ID).eq('month_year', '2026-04').single();
if (ritualStart.status === 'completed') {
  await sb.rpc('reset_april_ritual');
  console.log('(Reset April to pending before Gate 6)');
}

console.log('\n=== Gate 6 — Multi-allocation ritual → Reviewer Console reset ===');

const { data: goals } = await sb.from('goals').select('id, label, current_amount').eq('user_id', PRIYA_ID).eq('status', 'active');
const phone = goals.find(g => g.label === 'Phone fund');
const emergency = goals.find(g => g.label.toLowerCase().includes('emergency'));

const phoneBefore = Number(phone.current_amount);
const emergencyBefore = Number(emergency.current_amount);
console.log(`  Before: Phone=₹${phoneBefore}, Emergency=₹${emergencyBefore}`);

const { data: closeOut } = await sb.functions.invoke('ritual-close-out', { body: { month: '2026-04' } });
const lo = closeOut.total_leftover;
const a1 = Math.floor(lo * 0.5);
const a2 = Math.floor(lo * 0.3);
const a3 = Math.floor(lo) - a1 - a2;
const sb_breakdown = { discretionary_leftover: closeOut.discretionary_leftover, commitment_buffers: closeOut.commitment_buffers, commitment_overruns: closeOut.commitment_overruns };

const { error: completeErr } = await sb.rpc('complete_monthly_ritual', {
  p_month_year: '2026-04',
  p_allocations: [
    { destination_kind: 'goal',           destination_goal_id: phone.id,     total_amount: a1, source_breakdown: sb_breakdown },
    { destination_kind: 'emergency_fund', destination_goal_id: emergency.id, total_amount: a2, source_breakdown: sb_breakdown },
    { destination_kind: 'carry_forward',  destination_goal_id: null,         total_amount: a3, source_breakdown: sb_breakdown },
  ],
});
if (completeErr) { console.error('Complete error:', completeErr); process.exit(1); }

const { data: phoneMid } = await sb.from('goals').select('current_amount').eq('id', phone.id).single();
const { data: emergencyMid } = await sb.from('goals').select('current_amount').eq('id', emergency.id).single();
const { data: allocsMid } = await sb.from('rollover_allocations').select('id').eq('user_id', PRIYA_ID).eq('ritual_month', '2026-04-01');
console.log(`  After complete: Phone=₹${phoneMid.current_amount}, Emergency=₹${emergencyMid.current_amount}, rows=${allocsMid.length}`);

// Now reset via Reviewer Console RPC
const { data: resetRes, error: resetErr } = await sb.rpc('reset_april_ritual');
if (resetErr) { console.error('Reset error:', resetErr); process.exit(1); }
console.log(`  Reset result: status=${resetRes.status}, count=${resetRes.reverted_count}, total=₹${resetRes.reverted_total}`);
console.log(`  Reverted allocations: ${JSON.stringify(resetRes.reverted_allocations)}`);

const { data: phoneFinal } = await sb.from('goals').select('current_amount').eq('id', phone.id).single();
const { data: emergencyFinal } = await sb.from('goals').select('current_amount').eq('id', emergency.id).single();
const { data: allocsFinal } = await sb.from('rollover_allocations').select('id').eq('user_id', PRIYA_ID).eq('ritual_month', '2026-04-01');
const { data: ritualFinal } = await sb.from('monthly_rituals').select('status, completed_at, close_out_snapshot').eq('user_id', PRIYA_ID).eq('month_year', '2026-04').single();

console.log(`  After reset: Phone=₹${phoneFinal.current_amount} (expected ₹${phoneBefore}) ${Number(phoneFinal.current_amount) === phoneBefore ? '✓' : '✗'}`);
console.log(`               Emergency=₹${emergencyFinal.current_amount} (expected ₹${emergencyBefore}) ${Number(emergencyFinal.current_amount) === emergencyBefore ? '✓' : '✗'}`);
console.log(`               Allocation rows: ${allocsFinal.length} (expected 0) ${allocsFinal.length === 0 ? '✓' : '✗'}`);
console.log(`               Ritual: status=${ritualFinal.status}, completed_at=${ritualFinal.completed_at}, snapshot=${ritualFinal.close_out_snapshot}`);
console.log(`               Status=pending ${ritualFinal.status === 'pending' ? '✓' : '✗'}`);
console.log(`               completed_at=null ${ritualFinal.completed_at === null ? '✓' : '✗'}`);
console.log(`               close_out_snapshot=null ${ritualFinal.close_out_snapshot === null ? '✓' : '✗'}`);

// Idempotency: second reset should return already_pending
const { data: r2 } = await sb.rpc('reset_april_ritual');
console.log(`  Idempotency: status=${r2.status} ${r2.status === 'already_pending' ? '✓' : '✗'}`);

process.exit(0);
