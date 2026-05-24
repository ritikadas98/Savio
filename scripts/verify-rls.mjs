import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const pw = process.env.DEMO_PRIYA_PASSWORD;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required. Add it to .env.local — see .env.example.');
  process.exit(1);
}

async function inspectPolicies() {
  const pg = new Client({ connectionString });
  await pg.connect();
  const tables = ['profiles','commitments','goals','transactions','reflections','merchant_stats','monthly_rituals','windfalls','chat_messages','saved_decisions'];
  const res = await pg.query(
    `SELECT tablename, policyname, cmd, qual, with_check
     FROM pg_policies
     WHERE schemaname = 'public' AND tablename = ANY($1)
     ORDER BY tablename, cmd, policyname;`,
    [tables]
  );
  console.log(`\n=== pg_policies (${res.rows.length} rows) ===`);
  for (const r of res.rows) {
    const q = (r.qual || r.with_check || '').replace(/\s+/g, ' ');
    const usesJoin = q.includes('FROM profiles') || q.includes('profiles.auth_user_id');
    const flag = r.tablename === 'profiles' ? '(profile-direct)' : (usesJoin ? 'JOIN' : 'DIRECT auth.uid() ← BROKEN');
    console.log(`  ${r.tablename.padEnd(20)} ${r.cmd.padEnd(8)} ${r.policyname.padEnd(40)} ${flag}`);
  }
  await pg.end();
}

async function authedCounts() {
  const sb = createClient(url, anonKey);
  const { data: signIn, error: signInErr } = await sb.auth.signInWithPassword({
    email: 'priya@savio.demo',
    password: pw,
  });
  if (signInErr) throw signInErr;
  console.log(`\n=== Signed in as priya@savio.demo (auth.uid=${signIn.user.id}) ===`);

  const { data: profileRows, error: profErr } = await sb.from('profiles').select('full_name');
  console.log(`profiles -> ${profErr ? 'ERR: '+profErr.message : JSON.stringify(profileRows)}`);

  const { count: cCount, error: cErr } = await sb.from('commitments').select('*', { count: 'exact', head: true });
  console.log(`commitments count -> ${cErr ? 'ERR: '+cErr.message : cCount}`);

  const { count: gCount, error: gErr } = await sb.from('goals').select('*', { count: 'exact', head: true });
  console.log(`goals count -> ${gErr ? 'ERR: '+gErr.message : gCount}`);

  const { count: tCount, error: tErr } = await sb.from('transactions').select('*', { count: 'exact', head: true });
  console.log(`transactions count -> ${tErr ? 'ERR: '+tErr.message : tCount}`);

  const { count: rCount, error: rErr } = await sb.from('reflections').select('*', { count: 'exact', head: true });
  console.log(`reflections count -> ${rErr ? 'ERR: '+rErr.message : rCount}`);

  const { count: wCount, error: wErr } = await sb.from('windfalls').select('*', { count: 'exact', head: true });
  console.log(`windfalls count -> ${wErr ? 'ERR: '+wErr.message : wCount}`);

  const { count: mrCount, error: mrErr } = await sb.from('monthly_rituals').select('*', { count: 'exact', head: true });
  console.log(`monthly_rituals count -> ${mrErr ? 'ERR: '+mrErr.message : mrCount}`);
}

await inspectPolicies();
await authedCounts();
process.exit(0);
