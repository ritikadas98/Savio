// Phase 3 Doc 1 — Gate 0 SQL verification.
// Confirms the commitment_id linkage backfill works as designed:
//   - All 16 commitments (13 fixed + 3 variable) are linked to transactions
//   - Truly discretionary transactions (Other category) stay NULL
//   - April-specific sanity: actuals are believable

import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const PRIYA_ID = '00000000-0000-4000-a000-000000000001';

console.log('\n=== Q1. Linked count per commitment ===');
const q1 = await c.query(`
  SELECT
    c.kind,
    c.label,
    c.amount AS budgeted_monthly,
    c.category,
    COUNT(t.id)::int AS linked_count,
    COALESCE(SUM(t.amount), 0)::numeric AS linked_total_all_time
  FROM commitments c
  LEFT JOIN transactions t ON t.commitment_id = c.id
  WHERE c.user_id = $1
  GROUP BY c.id, c.kind, c.label, c.amount, c.category
  ORDER BY c.kind, c.label;
`, [PRIYA_ID]);
console.log('  kind     | label                | budget   | category      | count |  6-mo total');
console.log('  ---------+----------------------+----------+---------------+-------+------------');
for (const r of q1.rows) {
  console.log(`  ${r.kind.padEnd(8)} | ${r.label.padEnd(20)} | ₹${String(Number(r.budgeted_monthly).toLocaleString('en-IN')).padStart(7)} | ${(r.category ?? '').padEnd(13)} | ${String(r.linked_count).padStart(5)} | ₹${Number(r.linked_total_all_time).toLocaleString('en-IN').padStart(11)}`);
}

console.log('\n=== Q2. Discretionary (commitment_id IS NULL) ===');
const q2 = await c.query(`
  SELECT
    direction,
    category,
    COUNT(*)::int AS count,
    COALESCE(SUM(amount), 0)::numeric AS total
  FROM transactions
  WHERE user_id = $1 AND commitment_id IS NULL
  GROUP BY direction, category
  ORDER BY direction, category;
`, [PRIYA_ID]);
for (const r of q2.rows) {
  console.log(`  ${r.direction.padEnd(7)} ${(r.category ?? '(null)').padEnd(15)} ${String(r.count).padStart(4)} txns  ₹${Number(r.total).toLocaleString('en-IN')}`);
}
const q2sum = await c.query(`SELECT COUNT(*)::int AS c FROM transactions WHERE user_id = $1`, [PRIYA_ID]);
const q2null = await c.query(`SELECT COUNT(*)::int AS c FROM transactions WHERE user_id = $1 AND commitment_id IS NULL`, [PRIYA_ID]);
const q2linked = q2sum.rows[0].c - q2null.rows[0].c;
console.log(`  ----------------------------------------------------`);
console.log(`  Total transactions:  ${q2sum.rows[0].c}`);
console.log(`  Linked:              ${q2linked} (${((q2linked / q2sum.rows[0].c) * 100).toFixed(1)}%)`);
console.log(`  Discretionary NULL:  ${q2null.rows[0].c} (${((q2null.rows[0].c / q2sum.rows[0].c) * 100).toFixed(1)}%)`);

console.log('\n=== Q3. April actuals per commitment (the close-out source data) ===');
const q3 = await c.query(`
  SELECT
    c.kind,
    c.label,
    c.amount AS budgeted,
    COALESCE(SUM(t.amount), 0)::numeric AS april_actual,
    COUNT(t.id)::int AS april_txn_count
  FROM commitments c
  LEFT JOIN transactions t ON t.commitment_id = c.id
    AND t.occurred_at >= '2026-04-01' AND t.occurred_at < '2026-05-01'
  WHERE c.user_id = $1
  GROUP BY c.id, c.kind, c.label, c.amount
  ORDER BY c.kind, c.label;
`, [PRIYA_ID]);
console.log('  kind     | label                |  budgeted |  actual  |  buffer  | txns');
console.log('  ---------+----------------------+-----------+----------+----------+------');
let totalBudget = 0, totalActualFixed = 0, totalActualVar = 0, totalBufferVar = 0;
for (const r of q3.rows) {
  const budgeted = Number(r.budgeted);
  const actual = Number(r.april_actual);
  const buffer = budgeted - actual;
  console.log(`  ${r.kind.padEnd(8)} | ${r.label.padEnd(20)} | ₹${String(budgeted.toLocaleString('en-IN')).padStart(8)} | ₹${String(actual.toLocaleString('en-IN')).padStart(7)} | ${(buffer >= 0 ? '+' : '') + '₹' + buffer.toLocaleString('en-IN').padStart(6)} | ${String(r.april_txn_count).padStart(4)}`);
  if (r.kind === 'fixed') { totalActualFixed += actual; }
  else { totalActualVar += actual; totalBufferVar += buffer; }
  totalBudget += budgeted;
}
console.log(`  ---------+----------------------+-----------+----------+----------+------`);
console.log(`  Total April fixed actuals:    ₹${totalActualFixed.toLocaleString('en-IN')}`);
console.log(`  Total April variable actuals: ₹${totalActualVar.toLocaleString('en-IN')}`);
console.log(`  Variable net buffer/overrun:  ${totalBufferVar >= 0 ? '+' : ''}₹${totalBufferVar.toLocaleString('en-IN')}`);

console.log('\n=== Q4. Variable-commitment overlap sanity (any double-linked txns?) ===');
const q4 = await c.query(`
  SELECT t.id, t.merchant, t.category, c1.label AS linked_to
  FROM transactions t
  JOIN commitments c1 ON c1.id = t.commitment_id
  WHERE t.user_id = $1
    AND c1.kind = 'variable'
    AND (t.merchant IS NULL OR t.category IS NULL)
  LIMIT 10;
`, [PRIYA_ID]);
console.log(`  Variable-linked txns with NULL merchant/category: ${q4.rows.length} (should be 0)`);

await c.end();
process.exit(0);
