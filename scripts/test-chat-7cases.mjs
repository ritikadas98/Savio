// Run the 7-case chat audit against the deployed chat-respond Edge Function.
// Signs in as Priya, clears her chat history (via service role), then invokes
// each query and prints the response + ai_metadata. Read the output and compare
// each row to the expected criteria from the task spec.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const url      = process.env.VITE_SUPABASE_URL;
const anonKey  = process.env.VITE_SUPABASE_ANON_KEY;
const svcKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pw       = process.env.DEMO_PRIYA_PASSWORD;

const userClient = createClient(url, anonKey);
const svc        = createClient(url, svcKey);

const { data: signIn, error: signErr } = await userClient.auth.signInWithPassword({
  email: 'priya@savio.demo',
  password: pw,
});
if (signErr) { console.error('Sign-in failed:', signErr); process.exit(1); }

// Resolve Priya's profile.id for the history cleanup
const { data: profile } = await userClient.from('profiles').select('id').eq('auth_user_id', signIn.user.id).single();
if (!profile) { console.error('No profile for Priya'); process.exit(1); }

console.log(`Signed in as Priya (profile.id=${profile.id})`);

// Clear chat history via service role (bypasses RLS)
const { error: delErr } = await svc.from('chat_messages').delete().eq('user_id', profile.id);
if (delErr) console.warn('History cleanup warning:', delErr.message);
else console.log('Cleared prior chat_messages for Priya.\n');

const CASES = [
  { n: 1, q: "What's my safe-to-spend?",                    expect: 'Grounded ₹41,532 (post-D.47 income raise); Verified; no Save Decision' },
  { n: 2, q: 'Can I afford a ₹5,000 watch?',                expect: '₹41,532 → ₹36,532 remaining; verdict_line cites impulse-wait threshold (₹3K) per D.51; rule_citations includes "impulse_wait"; Verified; Save Decision visible' },
  { n: 3, q: "What's my regret rate at Myntra?",            expect: '87.5% (over 8 reflections) post-D.38; bold labels; Verified; no Save Decision' },
  { n: 4, q: 'Am I on track for my phone fund?',            expect: 'References ₹8,000/₹35,000 phone fund, ₹4,000/month; Verified' },
  { n: 5, q: "Show me where I'm spending",                  expect: '₹47,468 non-investing (NOT ₹71,468); Verified' },
  { n: 6, q: 'Should I invest in ELSS?',                    expect: 'SEBI handoff (scope filter); no Verified; no Save Decision' },
  { n: 7, q: 'How am I doing this month?',                  expect: 'Grounded summary; Verified' },
  // D.53 (Stream 0.5t piece #9) — impulse-wait boundary cases.
  // Below threshold: no rule citation. Above: rule citation fires.
  // Boundary tests the AI's discipline at NOT fabricating rule
  // violations on amounts that don't actually cross the threshold.
  { n: 8, q: 'Can I afford a ₹2,500 watch?',                expect: 'Below ₹3,000 impulse-wait threshold; rule_citations: []; verdict_line does NOT cite impulse-wait; Verified' },
  { n: 9, q: 'Can I afford a ₹3,500 watch?',                expect: 'Above ₹3,000 impulse-wait threshold; rule_citations includes "impulse_wait"; verdict_line cites threshold + body restates 48-hour rule; Verified' },
  // D.66 (Spec 3) — buffer-aware verdict tiers. Cushion = ₹50K, STS = ₹26,532, safety_net = ₹1,00,000.
  { n: 10, q: 'Can I afford a ₹35,000 laptop?',             expect: 'Within-cushion YELLOW: verdict + tradeoffs name the drawdown + rebuild (₹50,000 → ₹41,532, ~1 month at ₹26,532/month) verbatim from the injected lever; never says "dipping into safety net"' },
  { n: 11, q: 'Can I afford an ₹85,000 laptop?',            expect: 'Beyond-cushion RED: verdict names ₹1,00,000 safety net; rule_citations includes "safety_net"; body explains STS+cushion exhausted (₹76,532 total) before the floor is reached' },
];

for (const c of CASES) {
  console.log('═'.repeat(72));
  console.log(`CASE ${c.n}: "${c.q}"`);
  console.log(`Expected: ${c.expect}`);
  console.log('─'.repeat(72));

  const { data, error } = await userClient.functions.invoke('chat-respond', { body: { message: c.q } });
  if (error) {
    console.log(`  ERROR: ${error.message}\n`);
    continue;
  }

  const meta = data?.ai_metadata ?? {};
  const resp = data?.response ?? '<no response>';

  console.log('Response:');
  console.log(resp.split('\n').map(l => '  ' + l).join('\n'));
  console.log('Metadata:', JSON.stringify({
    verified: meta.verified,
    fallback_used: meta.fallback_used,
    scope_filter_triggered: meta.scope_filter_triggered,
    is_verdict: meta.is_verdict,
    latency_ms: meta.latency_ms,
    corrections: meta.corrections,
  }, null, 2));

  // Re-clear history so each case runs in isolation, exposing whether the
  // four targeted fixes work without prior-turn contamination muddying it.
  await svc.from('chat_messages').delete().eq('user_id', profile.id);
  console.log('');
}

process.exit(0);
