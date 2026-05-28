// Stream 0.5m verification — confirm AI prose responses use the new three
// labels exactly and never the old "Observation / Stake / Partnership Offer"
// pattern. Run 5 prose-eligible queries via the deployed chat-respond
// Edge Function and grep each response.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { snapshotChat } from './lib/chat-snapshot.mjs';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { error: signErr } = await sb.auth.signInWithPassword({
  email: 'priya@savio.demo', password: process.env.DEMO_PRIYA_PASSWORD,
});
if (signErr) { console.error('Sign-in failed:', signErr.message); process.exit(1); }
const { data: { session } } = await sb.auth.getSession();
const { data: priyaProfile } = await sb.from('profiles').select('id').single();
const restoreChat = await snapshotChat(sb, priyaProfile.id);

async function ask(message) {
  const t0 = Date.now();
  const r = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/chat-respond`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: process.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });
  return { data: await r.json(), status: r.status, wall: Date.now() - t0 };
}

const NEW_LABELS = ['Where you stand', 'What it means', 'What you can do'];
const OLD_LABELS = ['Observation', 'Stake', 'Partnership Offer'];

const PROSE_QUERIES = [
  'What is my safe-to-spend?',
  'Show me where I am spending',
  'Am I on track this month?',
  'Tell me about my goals',
  'What is my regret rate at Myntra?',
];

let failed = 0;

try {
  await sb.rpc('clear_chat_history');

  console.log('=== PROSE QUERIES — verify new labels + absence of old labels ===\n');
  for (const q of PROSE_QUERIES) {
    await sb.rpc('clear_chat_history');
    const { data, status } = await ask(q);
    if (status !== 200) { console.log(`✗ "${q}" — status ${status}`); failed += 1; continue; }
    const text = data.response || '';
    const structured = data.ai_metadata?.structured;

    // Sanity: should be prose, not structured
    if (structured !== null) {
      console.log(`✗ "${q}" — unexpectedly structured (${structured?.verdict_color})`);
      failed += 1;
      continue;
    }

    const newHits = NEW_LABELS.filter(l => text.includes(l));
    const oldHits = OLD_LABELS.filter(l => text.includes(l));

    const allNewPresent = newHits.length === 3;
    const noOldPresent = oldHits.length === 0;
    const ok = allNewPresent && noOldPresent;

    console.log(`${ok ? '✓' : '✗'} "${q}"`);
    console.log(`    new labels found: [${newHits.join(', ') || 'none'}]`);
    console.log(`    old labels found: [${oldHits.join(', ') || 'none'}]`);
    // Brief sample of the response so we see the actual structure
    console.log(`    sample: ${text.slice(0, 180).replace(/\s+/g, ' ')}…`);
    console.log('');
    if (!ok) failed += 1;
  }
} finally {
  console.log('=== Cleanup: restore Priya\'s pre-test chat history ===');
  await restoreChat();
}

console.log(`\n${failed === 0 ? '✓ ALL CHECKS PASSED' : `✗ ${failed} CHECK(S) FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
