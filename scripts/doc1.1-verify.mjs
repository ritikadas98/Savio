// Phase 3 Doc 1.1 verification — runs Gates 1-4 + final close-out check.

import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const ID = '00000000-0000-4000-a000-000000000001';

console.log('\n=== Gate 1 — Determinism baseline (will compare to second run) ===');
const det1 = await c.query(`
  SELECT COUNT(*)::int AS n, SUM(amount)::numeric AS total, COUNT(DISTINCT merchant)::int AS unique_merchants
  FROM transactions WHERE user_id = $1`, [ID]);
console.log(`  txn count=${det1.rows[0].n}  total=₹${Number(det1.rows[0].total).toLocaleString('en-IN')}  unique_merchants=${det1.rows[0].unique_merchants}`);

console.log('\n=== Gate 2 — April unlabeled high-impact candidates ===');
const g2 = await c.query(`
  SELECT t.merchant, t.amount, t.occurred_at::date AS d
  FROM transactions t
  LEFT JOIN reflections r ON r.transaction_id = t.id
  WHERE t.user_id = $1
    AND t.occurred_at >= '2026-04-01' AND t.occurred_at < '2026-05-01'
    AND t.amount >= 1500
    AND r.id IS NULL
    AND t.commitment_id IS NULL
  ORDER BY t.amount DESC`, [ID]);
for (const r of g2.rows) console.log(`  ${r.merchant.padEnd(14)} ₹${Number(r.amount).toLocaleString('en-IN').padStart(7)}  ${r.d.toISOString().slice(0,10)}`);
const g2top = g2.rows[0] && Number(g2.rows[0].amount);
const g2second = g2.rows[1] && Number(g2.rows[1].amount);
console.log(`  Top ≥ ₹4,000? ${g2top >= 4000 ? '✓' : '✗'}   Second ≥ ₹1,500? ${g2second >= 1500 ? '✓' : '✗'}`);

console.log('\n=== Gate 3 — Historical labeled corpus ===');
const g3 = await c.query(`
  SELECT t.merchant, r.label, COUNT(*)::int AS n
  FROM reflections r JOIN transactions t ON t.id = r.transaction_id
  WHERE r.user_id = $1
  GROUP BY t.merchant, r.label ORDER BY t.merchant, r.label`, [ID]);
for (const r of g3.rows) console.log(`  ${r.merchant.padEnd(10)} ${r.label.padEnd(9)} ${r.n}`);
const tot = await c.query(`SELECT COUNT(*)::int AS n FROM reflections WHERE user_id = $1`, [ID]);
console.log(`  Total reflections: ${tot.rows[0].n}`);
const myntra = await c.query(`
  SELECT COUNT(*) FILTER (WHERE r.label = 'regret')::float / NULLIF(COUNT(*), 0) AS rate,
         COUNT(*)::int AS n
  FROM reflections r JOIN transactions t ON t.id = r.transaction_id
  WHERE r.user_id = $1 AND t.merchant ILIKE '%myntra%'`, [ID]);
console.log(`  Myntra regret rate: ${myntra.rows[0].rate}  (over ${myntra.rows[0].n} reflections)`);

console.log('\n=== Gate 4 — Eating out overrun ===');
const g4 = await c.query(`
  SELECT c.label, c.amount AS budgeted, COALESCE(SUM(t.amount),0)::numeric AS actual
  FROM commitments c
  LEFT JOIN transactions t ON t.commitment_id = c.id AND t.occurred_at >= '2026-04-01' AND t.occurred_at < '2026-05-01'
  WHERE c.user_id = $1 AND c.kind = 'variable'
  GROUP BY c.id, c.label, c.amount ORDER BY c.label`, [ID]);
for (const r of g4.rows) {
  const b = Number(r.budgeted), a = Number(r.actual);
  const delta = b - a;
  console.log(`  ${r.label.padEnd(12)} budgeted=₹${b.toLocaleString('en-IN').padStart(6)}  actual=₹${a.toLocaleString('en-IN').padStart(8)}  ${delta >= 0 ? 'buffer +' : 'overrun −'}₹${Math.abs(delta).toLocaleString('en-IN')}`);
}

console.log('\n=== April reflections (should be 0 — ritual handles April labeling) ===');
const aprilRefs = await c.query(`
  SELECT COUNT(*)::int AS n
  FROM reflections r JOIN transactions t ON t.id = r.transaction_id
  WHERE r.user_id = $1 AND t.occurred_at >= '2026-04-01' AND t.occurred_at < '2026-05-01'`, [ID]);
console.log(`  April-dated reflections: ${aprilRefs.rows[0].n}`);

await c.end();
process.exit(0);
