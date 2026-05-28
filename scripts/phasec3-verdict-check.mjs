// Phase C3 sanity check — call chat-respond with verdict-eligible and
// non-eligible queries; verify structured vs prose dispatch + fallback.
//
// Verdict-eligible (5): each must return ai_metadata.structured with a valid
//   shape and verdict_color in {GREEN, YELLOW, RED}.
// Non-eligible (5): each must return ai_metadata.structured === null.

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
  const data = await r.json();
  return { data, status: r.status, wall: Date.now() - t0 };
}

function isValidStructured(s) {
  if (!s || typeof s !== 'object') return false;
  if (!['GREEN', 'YELLOW', 'RED'].includes(s.verdict_color)) return false;
  if (typeof s.verdict_line !== 'string' || !s.verdict_line) return false;
  if (typeof s.body !== 'string' || !s.body) return false;
  if (!Array.isArray(s.tradeoffs) || s.tradeoffs.length < 2 || s.tradeoffs.length > 4) return false;
  if (!s.tradeoffs.every(t => typeof t === 'string' && t.length > 0)) return false;
  if (typeof s.best_next_step !== 'string' || !s.best_next_step) return false;
  return true;
}

const VERDICT_QUERIES = [
  'Can I afford a ₹5,000 watch?',
  // NOTE: avoid phrases like "right now" / "this time" — the pre-existing
  // scope filter (supabase/functions/chat-respond/scope_filter.ts) treats
  // those as market-timing queries and deflects with SEBI handoff.
  'Should I buy a ₹50,000 laptop?',
  'Should I get a ₹500/month coffee subscription?',
  'Is ₹8,000 on a friend\'s birthday gift OK?',
  'Can I do a ₹2,000 dinner this weekend?',
];

const PROSE_QUERIES = [
  'Am I on track this month?',
  'What is my regret rate at Myntra?',
  'Show me where I am spending',
  'Tell me about my goals',
  'How does Savio work?',
];

let failed = 0;
const verdictResults = [];

try {
  // First, clear chat history so prior conversations don't bleed into the
  // model's context (history is sent on every call per chat-respond/index.ts:78-86).
  console.log('=== Pre: clear chat history ===');
  await sb.rpc('clear_chat_history');

  console.log('\n=== VERDICT-ELIGIBLE QUERIES (expect structured) ===');
  for (const q of VERDICT_QUERIES) {
    await sb.rpc('clear_chat_history');  // isolate each turn
    const { data, status, wall } = await ask(q);
    if (status !== 200) { console.log(`  ✗ "${q}" — status ${status}`); failed += 1; continue; }
    const s = data.ai_metadata?.structured;
    const ok = isValidStructured(s);
    const color = s?.verdict_color ?? '—';
    console.log(`  ${ok ? '✓' : '✗'} [${color.padEnd(6)}] "${q}"  (${wall}ms)`);
    if (ok) {
      console.log(`        ${s.verdict_line}`);
      console.log(`        tradeoffs: ${s.tradeoffs.length} items`);
      console.log(`        best_next_step: ${s.best_next_step.slice(0, 80)}${s.best_next_step.length > 80 ? '…' : ''}`);

      // C.26 Gate 8.D — no color names anywhere across all four structured fields
      const allFields = [s.verdict_line, s.body, s.best_next_step, ...s.tradeoffs].join(' ');
      const colorMatch = allFields.match(/\b(GREEN|YELLOW|RED|green\s+light|yellow\s+light|red\s+light|greenlight|yellowlight|redlight)\b/i);
      if (colorMatch) {
        console.log(`        ✗ ACTION LANG FAIL — color-name "${colorMatch[0]}" leaked into prose`);
        failed += 1;
      }
      // C.26 — verdict_line opener
      const openerExpect = { GREEN: /^Go ahead\s*—/i, YELLOW: /^Think twice\s*—/i, RED: /^Step back\s*—/i }[color];
      if (openerExpect && !openerExpect.test(s.verdict_line)) {
        console.log(`        ✗ ACTION LANG FAIL — verdict_line opener doesn't match ${color}`);
        failed += 1;
      }
      verdictResults.push({ q, color });
    } else {
      console.log(`        FAIL — structured: ${JSON.stringify(s).slice(0, 200)}`);
      failed += 1;
    }
  }

  console.log('\n=== NON-ELIGIBLE QUERIES (expect prose, structured=null) ===');
  for (const q of PROSE_QUERIES) {
    await sb.rpc('clear_chat_history');
    const { data, status, wall } = await ask(q);
    if (status !== 200) { console.log(`  ✗ "${q}" — status ${status}`); failed += 1; continue; }
    const s = data.ai_metadata?.structured;
    const proseOk = s === null;
    const responseSnippet = (data.response || '').replace(/\s+/g, ' ').slice(0, 100);
    console.log(`  ${proseOk ? '✓' : '✗'} "${q}"  (${wall}ms)`);
    console.log(`        ${responseSnippet}…`);
    if (!proseOk) {
      console.log(`        FAIL — got structured: ${s?.verdict_color}`);
      failed += 1;
    }
  }
} finally {
  console.log('\n=== Cleanup: restore Priya\'s pre-test chat history ===');
  await restoreChat();
}

console.log(`\n${failed === 0 ? '✓ ALL CHECKS PASSED' : `✗ ${failed} CHECK(S) FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
