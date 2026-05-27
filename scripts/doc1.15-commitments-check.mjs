import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const ID = '00000000-0000-4000-a000-000000000001';

const dueThisWeek = await c.query(`
  SELECT label, due_day_of_month, amount
  FROM commitments
  WHERE user_id = $1 AND kind = 'fixed' AND due_day_of_month BETWEEN 1 AND 7
  ORDER BY due_day_of_month, label`, [ID]);
console.log(`Due this week (days 1-7, fixed only): ${dueThisWeek.rows.length} commitments`);
for (const r of dueThisWeek.rows) {
  console.log(`  day ${String(r.due_day_of_month).padStart(2)}  ${r.label.padEnd(20)} ₹${r.amount}`);
}

const paidThisWeek = await c.query(`
  SELECT COUNT(*)::int AS n
  FROM transactions
  WHERE user_id = $1
    AND commitment_id IS NOT NULL
    AND occurred_at >= '2026-05-01'
    AND occurred_at < '2026-05-08'`, [ID]);
console.log(`\nPaid this week (May 1-7 with commitment_id): ${paidThisWeek.rows[0].n}`);

await c.end();
