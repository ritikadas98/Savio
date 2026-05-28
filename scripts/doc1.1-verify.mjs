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

console.log('\n=== April reflections ===');
// Pre-D.38 expectation was 0 (ritual handles April labeling).
// Post-D.38 (Stream 0.5r piece #7), the seed pre-labels 6 late-April rows
// (2 Amazon glad, 2 Myntra regret, 2 Zara glad) to populate the Path B
// current 30-day window for the merchant trend stories. Expected: 6.
// The two ritual-labeling-candidate unlabeled April rows (Myntra ₹4,800 +
// Amazon ₹1,950) still flow through Reflect's labeling surface as before.
const aprilRefs = await c.query(`
  SELECT COUNT(*)::int AS n
  FROM reflections r JOIN transactions t ON t.id = r.transaction_id
  WHERE r.user_id = $1 AND t.occurred_at >= '2026-04-01' AND t.occurred_at < '2026-05-01'`, [ID]);
console.log(`  April-dated reflections: ${aprilRefs.rows[0].n}   ${aprilRefs.rows[0].n === 6 ? '✓' : '✗ (expected 6 post-D.38)'}`);

console.log('\n=== D.38 Trend stories — current vs prior 90d Path B buckets ===');
// Three merchant trend stories: Amazon improving, Myntra worsening,
// Zara improving. Current window = (DEMO_TODAY - 30d, DEMO_TODAY).
// Prior window = (DEMO_TODAY - 120d, DEMO_TODAY - 30d).
const trends = await c.query(`
  WITH params AS (SELECT '2026-05-01'::timestamptz AS now)
  SELECT
    t.merchant,
    SUM(CASE WHEN t.occurred_at >= params.now - interval '30 days' AND t.occurred_at < params.now THEN 1 ELSE 0 END)::int AS current_total,
    SUM(CASE WHEN t.occurred_at >= params.now - interval '30 days' AND t.occurred_at < params.now AND r.label = 'regret' THEN 1 ELSE 0 END)::int AS current_regret,
    SUM(CASE WHEN t.occurred_at >= params.now - interval '120 days' AND t.occurred_at < params.now - interval '30 days' THEN 1 ELSE 0 END)::int AS prior_total,
    SUM(CASE WHEN t.occurred_at >= params.now - interval '120 days' AND t.occurred_at < params.now - interval '30 days' AND r.label = 'regret' THEN 1 ELSE 0 END)::int AS prior_regret
  FROM reflections r
  JOIN transactions t ON t.id = r.transaction_id
  CROSS JOIN params
  WHERE r.user_id = $1 AND t.merchant IN ('Amazon','Myntra','Zara')
  GROUP BY t.merchant
  ORDER BY t.merchant`, [ID]);
for (const r of trends.rows) {
  const cur = r.current_total > 0 ? Math.round((r.current_regret / r.current_total) * 100) : null;
  const pri = r.prior_total >= 2 ? Math.round((r.prior_regret / r.prior_total) * 100) : null;
  const delta = (cur != null && pri != null) ? `${cur - pri > 0 ? '+' : ''}${cur - pri}` : '—';
  console.log(`  ${r.merchant.padEnd(8)} current=${String(cur ?? '—').padStart(4)}% (${r.current_total} refs)   prior=${String(pri ?? '—').padStart(4)}% (${r.prior_total} refs)   delta=${delta}`);
}

await c.end();
process.exit(0);
