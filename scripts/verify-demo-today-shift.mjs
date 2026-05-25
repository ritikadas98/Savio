// Phase 2.95 verification queries — confirm the seed re-ran with DEMO_TODAY=2026-05-01
// and produces the expected world state.

import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) { console.error('DATABASE_URL not set'); process.exit(1); }

const c = new Client({ connectionString });
await c.connect();

const PRIYA_ID = '00000000-0000-4000-a000-000000000001';

console.log('\n=== 1. monthly_rituals state ===');
const r1 = await c.query(
  `SELECT month_year, status, completed_at, safe_to_spend_locked
   FROM monthly_rituals WHERE user_id = $1 ORDER BY month_year`,
  [PRIYA_ID],
);
for (const row of r1.rows) {
  console.log(`  ${row.month_year} | ${row.status.padEnd(9)} | completed_at=${row.completed_at ?? 'NULL'} | safe_to_spend_locked=${row.safe_to_spend_locked ?? 'NULL'}`);
}

console.log('\n=== 2. Transactions span ===');
const r2 = await c.query(
  `SELECT MIN(occurred_at)::date AS earliest, MAX(occurred_at)::date AS latest, COUNT(*)::int AS count
   FROM transactions WHERE user_id = $1`,
  [PRIYA_ID],
);
const t = r2.rows[0];
console.log(`  earliest: ${t.earliest.toISOString().slice(0,10)}`);
console.log(`  latest:   ${t.latest.toISOString().slice(0,10)}`);
console.log(`  count:    ${t.count}`);

console.log('\n=== 3. April 2026 transactions (closeable month) ===');
const r3 = await c.query(
  `SELECT COUNT(*)::int AS count, SUM(amount)::numeric AS total, MIN(occurred_at)::date AS first, MAX(occurred_at)::date AS last
   FROM transactions
   WHERE user_id = $1
     AND occurred_at >= '2026-04-01' AND occurred_at < '2026-05-01'`,
  [PRIYA_ID],
);
const a = r3.rows[0];
console.log(`  count: ${a.count}`);
console.log(`  total: ₹${Number(a.total).toLocaleString('en-IN')}`);
console.log(`  span:  ${a.first?.toISOString().slice(0,10)} → ${a.last?.toISOString().slice(0,10)}`);

console.log('\n=== 4. May 2026 transactions (current month, should be ~0 or just salary) ===');
const r4 = await c.query(
  `SELECT occurred_at::date, merchant, amount, direction
   FROM transactions
   WHERE user_id = $1
     AND occurred_at >= '2026-05-01'
   ORDER BY occurred_at`,
  [PRIYA_ID],
);
console.log(`  count: ${r4.rows.length}`);
for (const row of r4.rows) {
  console.log(`    ${row.occurred_at.toISOString().slice(0,10)} | ${row.merchant?.padEnd(20) ?? ''} | ${row.direction} ₹${Number(row.amount).toLocaleString('en-IN')}`);
}

await c.end();
process.exit(0);
