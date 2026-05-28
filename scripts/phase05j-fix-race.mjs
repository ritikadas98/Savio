// Stream 0.5j-fix — verify the new refreshReflections ordering prevents the
// race. The fix sequences operations as:
//   1. await invalidate_patterns_cache   (synchronous server-side delete)
//   2. await fetch new reflections
//   3. setReflections → patterns effect fires → synthesize-patterns invoked
//
// This script reproduces that ordering and asserts the final synthesize call
// returns cached=false. The OLD ordering (setReflections before invalidate)
// would leave the cache row in place when the function read it.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { error: signErr } = await sb.auth.signInWithPassword({
  email: 'priya@savio.demo', password: process.env.DEMO_PRIYA_PASSWORD,
});
if (signErr) { console.error('Sign-in failed:', signErr.message); process.exit(1); }
const { data: { session } } = await sb.auth.getSession();

// Direct fetch helper — supabase.functions.invoke has a short timeout that
// trips on cold Vertex JWT mints (10-15s); raw fetch lets us see actual results.
async function invoke(body) {
  const t0 = Date.now();
  const r = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/synthesize-patterns`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: process.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const wall = Date.now() - t0;
  const data = await r.json();
  return { data, status: r.status, wall };
}

console.log('=== Step 1: prime cache ===');
const r0 = await invoke({ force_refresh: true });
console.log(`  status=${r0.status} source=${r0.data.source} cached=${r0.data.cached} wall=${r0.wall}ms`);

console.log('\n=== Step 2: simulate label tap → handleLabel inserts a reflection ===');
// Pick any unlabeled debit transaction; insert + cleanup later
const { data: profile } = await sb.from('profiles').select('id').single();
const { data: candidate } = await sb.from('transactions')
  .select('id')
  .eq('user_id', profile.id)
  .eq('direction', 'debit')
  .gt('amount', 1000)
  .gte('occurred_at', '2026-04-01T00:00:00Z')
  .order('occurred_at', { ascending: false })
  .limit(1)
  .single();

const { data: inserted, error: insErr } = await sb.from('reflections')
  .insert({ user_id: profile.id, transaction_id: candidate.id, label: 'regret' })
  .select()
  .single();
if (insErr) { console.error('Insert failed:', insErr.message); process.exit(1); }
console.log(`  inserted reflection ${inserted.id} for txn ${candidate.id}`);

// Phase D D.11 — wrap state-mutating section in try/finally so a thrown
// assertion or network error doesn't leave the test reflection persisted.
// Pre-D this script was the main source of stale April-dated reflection
// leftovers caught during Phase B/C verification.
let failed = 0;
try {
  console.log('\n=== Step 3: simulate NEW refreshReflections ordering (fix) ===');
  console.log('  3a. await invalidate_patterns_cache  (BEFORE setReflections)');
  await sb.rpc('invalidate_patterns_cache');
  const { data: cacheAfterInvalidate } = await sb.from('reflection_patterns_cache').select('*').eq('user_id', profile.id).maybeSingle();
  console.log(`      cache row: ${cacheAfterInvalidate ? 'EXISTS (bad)' : 'null (good)'}`);

  console.log('  3b. (fetch new reflections — skipped, not what we are testing)');
  console.log('  3c. (setReflections fires patterns effect — simulated by next invoke below)');

  console.log('\n=== Step 4: next synthesize call → expect cached=false ===');
  const r1 = await invoke({});
  console.log(`  status=${r1.status} source=${r1.data.source} cached=${r1.data.cached} latency_ms=${r1.data.latency_ms} wall=${r1.wall}ms`);

  if (r1.data.cached !== false) {
    console.log('  ✗ FAIL: expected cached=false (race fix not effective)');
    failed += 1;
  } else {
    console.log('  ✓ cached=false — race fix is effective');
  }

  if (!r1.data.patterns || r1.data.patterns.length === 0) {
    console.log('  ✗ FAIL: expected non-empty patterns');
    failed += 1;
  } else {
    console.log(`  ✓ ${r1.data.patterns.length} fresh patterns derived from updated aggregates`);
  }
} finally {
  console.log('\n=== Cleanup: remove the test reflection + invalidate cache ===');
  await sb.from('reflections').delete().eq('id', inserted.id);
  await sb.rpc('invalidate_patterns_cache');
  console.log('  done.');
}

console.log(`\n${failed === 0 ? '✓ ALL CHECKS PASSED' : `✗ ${failed} CHECK(S) FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
