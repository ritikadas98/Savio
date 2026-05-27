// Stream 0.5j sanity check — invoke the deployed synthesize-patterns Edge
// Function, verify shape + latency + cache behavior, then clean up.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data: signIn, error: signErr } = await sb.auth.signInWithPassword({
  email: 'priya@savio.demo', password: process.env.DEMO_PRIYA_PASSWORD,
});
if (signErr) { console.error('Sign-in failed:', signErr.message); process.exit(1); }
const { data: profile } = await sb.from('profiles').select('id').eq('auth_user_id', signIn.user.id).single();

console.log('=== Pre: clear cache for a clean run ===');
await sb.rpc('invalidate_patterns_cache');
const { data: pre } = await sb.from('reflection_patterns_cache').select('*').eq('user_id', profile.id).maybeSingle();
console.log('  cache row pre-invoke:', pre ?? 'null (good)');

console.log('\n=== Call 1: cold (cache miss) — expect AI call + cache write ===');
const t0 = Date.now();
const { data: r1, error: e1 } = await sb.functions.invoke('synthesize-patterns', { body: {} });
const wall1 = Date.now() - t0;
if (e1) { console.error('  invoke error:', e1.message); process.exit(1); }
if (r1?.error) { console.error('  function error:', r1.error); process.exit(1); }
console.log(`  source=${r1.source} cached=${r1.cached} server_latency=${r1.latency_ms}ms wall=${wall1}ms`);
console.log(`  patterns (${r1.patterns.length}):`);
r1.patterns.forEach((p, i) => {
  console.log(`    ${i + 1}. [${p.label}]`);
  console.log(`       ${p.body}`);
  console.log(`       sources: ${(p.source_aggregates ?? []).join(', ')}`);
});

if (!Array.isArray(r1.patterns) || r1.patterns.length < 1 || r1.patterns.length > 4) {
  console.error('FAIL: pattern count out of range');
  process.exit(1);
}
for (const p of r1.patterns) {
  if (!p.label || !p.body) { console.error('FAIL: empty label/body'); process.exit(1); }
}

console.log('\n=== Cache row written? ===');
const { data: cacheRow } = await sb.from('reflection_patterns_cache').select('source, expires_at, generated_at').eq('user_id', profile.id).single();
console.log(`  source=${cacheRow.source} generated_at=${cacheRow.generated_at} expires_at=${cacheRow.expires_at}`);
if (cacheRow.source !== 'ai') { console.error('FAIL: cached source not ai'); process.exit(1); }

console.log('\n=== Call 2: warm (cache hit) — expect cached=true, no AI call ===');
const t1 = Date.now();
const { data: r2 } = await sb.functions.invoke('synthesize-patterns', { body: {} });
const wall2 = Date.now() - t1;
console.log(`  source=${r2.source} cached=${r2.cached} wall=${wall2}ms`);
if (r2.cached !== true) { console.error('FAIL: 2nd call should hit cache'); process.exit(1); }

console.log('\n=== Call 3: force_refresh — bypass cache, re-call AI ===');
const t2 = Date.now();
const { data: r3 } = await sb.functions.invoke('synthesize-patterns', { body: { force_refresh: true } });
const wall3 = Date.now() - t2;
console.log(`  source=${r3.source} cached=${r3.cached} latency_ms=${r3.latency_ms} wall=${wall3}ms`);
if (r3.cached !== false) { console.error('FAIL: force_refresh should bypass cache'); process.exit(1); }

console.log('\n=== Invalidate via RPC ===');
const { data: invRes } = await sb.rpc('invalidate_patterns_cache');
console.log('  ', invRes);
const { data: post } = await sb.from('reflection_patterns_cache').select('*').eq('user_id', profile.id).maybeSingle();
console.log('  cache row post-invalidate:', post ?? 'null (good)');

console.log('\n=== Cleanup: leave cache empty so app fetches fresh on next mount ===');
console.log('\n✓ ALL CHECKS PASSED');
process.exit(0);
