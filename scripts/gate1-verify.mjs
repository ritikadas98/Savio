// Phase 3 Doc 1 — Gate 1 SQL verification (after 0008_rollover_allocations.sql).
// Confirms the schema is ready for the ritual write path.

import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

console.log('\n=== Q1. rollover_allocations table exists with RLS ===');
const q1 = await c.query(`
  SELECT relname, relrowsecurity
  FROM pg_class
  WHERE relname = 'rollover_allocations' AND relnamespace = 'public'::regnamespace;
`);
if (q1.rows.length === 0) {
  console.log('  ✗ rollover_allocations does NOT exist');
  process.exit(1);
}
console.log(`  ✓ relname=${q1.rows[0].relname}  rls_enabled=${q1.rows[0].relrowsecurity}`);

console.log('\n=== Q2. rollover_allocations policies (should be 2: select, insert; no update/delete) ===');
const q2 = await c.query(`
  SELECT policyname, cmd
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'rollover_allocations'
  ORDER BY cmd;
`);
for (const r of q2.rows) {
  console.log(`  - ${r.cmd.padEnd(7)} ${r.policyname}`);
}

console.log('\n=== Q3. rollover_allocations columns ===');
const q3 = await c.query(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'rollover_allocations'
  ORDER BY ordinal_position;
`);
for (const r of q3.rows) {
  console.log(`  ${r.column_name.padEnd(24)} ${r.data_type.padEnd(28)} nullable=${r.is_nullable}`);
}

console.log('\n=== Q4. monthly_rituals new columns ===');
const q4 = await c.query(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'monthly_rituals'
    AND column_name IN ('rollover_allocation_id', 'close_out_snapshot');
`);
for (const r of q4.rows) {
  console.log(`  ${r.column_name.padEnd(24)} ${r.data_type.padEnd(28)} nullable=${r.is_nullable}`);
}
if (q4.rows.length !== 2) {
  console.log(`  ✗ Expected 2 new columns, got ${q4.rows.length}`);
  process.exit(1);
}

console.log('\n=== Q5. April commitment-vs-actual for ritual close-out (re-confirm Gate 0) ===');
const q5 = await c.query(`
  SELECT
    c.kind, c.label,
    c.amount AS budgeted,
    COALESCE(SUM(t.amount), 0)::numeric AS april_actual
  FROM commitments c
  LEFT JOIN transactions t ON t.commitment_id = c.id
    AND t.occurred_at >= '2026-04-01' AND t.occurred_at < '2026-05-01'
  WHERE c.user_id = '00000000-0000-4000-a000-000000000001'
    AND c.kind = 'variable'
  GROUP BY c.id, c.kind, c.label, c.amount
  ORDER BY c.label;
`);
for (const r of q5.rows) {
  const b = Number(r.budgeted), a = Number(r.april_actual);
  console.log(`  ${r.label.padEnd(12)} budgeted=₹${b.toLocaleString('en-IN')}  actual=₹${a.toLocaleString('en-IN')}  ${b - a >= 0 ? 'buffer +' : 'overrun '}${(b - a >= 0 ? '+' : '')}₹${(b - a).toLocaleString('en-IN')}`);
}

await c.end();
process.exit(0);
