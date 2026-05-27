// Phase C1 sanity check — call complete_monthly_setup for May, verify write,
// then reset to leave the DB clean for visual testing.

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

console.log('=== Pre-state: May ritual row (should not exist) ===');
const { data: pre } = await sb.from('monthly_rituals').select('*').eq('user_id', PRIYA_ID).eq('month_year', '2026-05').maybeSingle();
console.log('  pre:', pre ?? 'null (good)');

const { data: phoneFund } = await sb.from('goals').select('id, label').eq('user_id', PRIYA_ID).eq('label', 'Phone fund').single();
console.log(`  Phone fund id: ${phoneFund.id}`);

console.log('\n=== Calling complete_monthly_setup ===');
const { data: res, error } = await sb.rpc('complete_monthly_setup', {
  p_month_year: '2026-05',
  p_focus_goal_id: phoneFund.id,
  p_safe_to_spend_locked: 12032,
  p_confirmed_income: 68500,
});
if (error) { console.error('RPC error:', error); process.exit(1); }
console.log(`  result: ${JSON.stringify(res)}`);

console.log('\n=== Post-state: May ritual row ===');
const { data: post } = await sb.from('monthly_rituals').select('month_year, status, focus_goal_id, safe_to_spend_locked, income_confirmed, commitments_confirmed, completed_at').eq('user_id', PRIYA_ID).eq('month_year', '2026-05').single();
console.log('  row:', JSON.stringify(post, null, 2));

console.log('\n=== Idempotency: call again, expect update not error ===');
const { data: res2 } = await sb.rpc('complete_monthly_setup', {
  p_month_year: '2026-05',
  p_focus_goal_id: null,            // change focus to null this time
  p_safe_to_spend_locked: 11500,    // change SPS
  p_confirmed_income: 68500,
});
console.log(`  result: ${JSON.stringify(res2)}`);
const { data: post2 } = await sb.from('monthly_rituals').select('focus_goal_id, safe_to_spend_locked').eq('user_id', PRIYA_ID).eq('month_year', '2026-05').single();
console.log(`  after update: focus=${post2.focus_goal_id ?? 'null'} sts=${post2.safe_to_spend_locked}`);

console.log('\n=== Cleanup: delete the May row so home banner logic stays predictable ===');
await sb.from('monthly_rituals').delete().eq('user_id', PRIYA_ID).eq('month_year', '2026-05');
console.log('  May ritual row deleted ✓');

process.exit(0);
