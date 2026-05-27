// Phase B2 sanity check — what unlabeled txs and reflection patterns does
// Priya's seed actually produce for the Reflect surface?

import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const ID = '00000000-0000-4000-a000-000000000001';

console.log('\n=== Unlabeled debit txs, amount > ₹1,000, no commitment filter (leaks intended for dismiss demo) ===');
const unlabeled = await c.query(`
  SELECT t.merchant, t.category, t.amount, t.occurred_at::date AS d, t.commitment_id
  FROM transactions t
  LEFT JOIN reflections r ON r.transaction_id = t.id
  WHERE t.user_id = $1
    AND t.direction = 'debit'
    AND t.amount > 1000
    AND t.occurred_at >= '2026-04-01'
    AND t.occurred_at < '2026-05-01'
    AND r.id IS NULL
  ORDER BY t.occurred_at DESC
  LIMIT 12`, [ID]);
console.log(`  count after >₹1,000 filter: ${unlabeled.rows.length}, showing top ${Math.min(8, unlabeled.rows.length)} on Reflect:`);
for (const r of unlabeled.rows.slice(0, 8)) {
  console.log(`  ${r.d.toISOString().slice(0,10)}  ${(r.merchant ?? 'Unknown').padEnd(20)}  ₹${Number(r.amount).toLocaleString('en-IN').padStart(7)}  ${r.category ?? ''}`);
}

console.log('\n=== All reflections (for patterns) ===');
const refs = await c.query(`
  SELECT r.label, t.merchant, t.category, t.amount
  FROM reflections r JOIN transactions t ON t.id = r.transaction_id
  WHERE r.user_id = $1
  ORDER BY r.reflected_at DESC`, [ID]);
console.log(`  ${refs.rows.length} reflections total`);
for (const r of refs.rows) {
  console.log(`    ${r.label.padEnd(8)} ${r.merchant.padEnd(10)} ${r.category.padEnd(12)} ₹${r.amount}`);
}

console.log('\n=== Pattern preview (expected output of derivePatterns) ===');
// Group by merchant
const byM = {};
for (const r of refs.rows) {
  byM[r.merchant] = byM[r.merchant] || [];
  byM[r.merchant].push(r);
}
for (const [m, items] of Object.entries(byM)) {
  const regret = items.filter(i => i.label === 'regret').length;
  if (items.length >= 3 && regret === items.length) {
    console.log(`  → "All ${items.length} ${m} purchases — you marked every one regret."`);
  } else if (regret >= 2 && regret / items.length >= 0.6) {
    console.log(`  → "${regret} of ${items.length} ${m} purchases — marked regret."`);
  }
}
// Group by category
const byC = {};
for (const r of refs.rows) {
  byC[r.category] = byC[r.category] || [];
  byC[r.category].push(r);
}
for (const [cat, items] of Object.entries(byC)) {
  if (items.length < 3) continue;
  const regretItems = items.filter(i => i.label === 'regret');
  if (regretItems.length / items.length < 0.6) continue;
  const sum = regretItems.reduce((s, i) => s + Number(i.amount), 0);
  console.log(`  → "${cat} — ${regretItems.length} of ${items.length} purchases marked regret. ₹${sum.toLocaleString('en-IN')} of avoidable spending."`);
}
// Overall rate
const reg = refs.rows.filter(r => r.label === 'regret').length;
const rate = Math.round(reg / refs.rows.length * 100);
console.log(`  → overall regret rate: ${rate}% across ${refs.rows.length} labels (threshold ≥60% triggers an overall pattern)`);

await c.end();
