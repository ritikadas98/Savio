import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required. Add it to .env.local — see .env.example.');
  process.exit(1);
}

const client = new Client({
  connectionString,
});

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupAuthUser() {
  const email = 'priya@savio.demo';
  const password = process.env.DEMO_PRIYA_PASSWORD;
  
  console.log(`Ensuring auth user ${email} exists...`);
  
  // Try to find if user already exists
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    throw listError;
  }
  
  const existingUser = usersData.users.find(u => u.email === email);
  if (existingUser) {
    console.log(`User ${email} already exists with ID: ${existingUser.id}`);
    return existingUser.id;
  }
  
  // Create user
  console.log(`Creating user ${email}...`);
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  
  if (error) {
    throw error;
  }
  
  console.log(`User ${email} created with ID: ${data.user.id}`);
  return data.user.id;
}

async function applyMigrations() {
  try {
    await client.connect();
    console.log('Connected to Supabase DB via pg.');

    await setupAuthUser();

    // Drop all tables in the public schema
    console.log('Dropping all tables in public schema...');
    const dropSchemaQuery = `
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `;
    await client.query(dropSchemaQuery);
    console.log('All public tables dropped.');

    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found.');
      return;
    }

    // Compute DEMO_TODAY = 1st of current calendar month in IST, in YYYY-MM-DD
    // form. The seed file (0006_seed_priya.sql) declares v_demo_today; we
    // substitute it dynamically so re-running this script produces a world
    // anchored to "the start of the month you ran it in" without manual edits.
    const istParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date());
    const demoYear = istParts.find(p => p.type === 'year').value;
    const demoMonth = istParts.find(p => p.type === 'month').value;
    const demoToday = `${demoYear}-${demoMonth}-01`;
    console.log(`Dynamic DEMO_TODAY for this seed run: ${demoToday}`);

    const files = fs.readdirSync(migrationsDir).sort();

    for (const file of files) {
      if (file.endsWith('.sql')) {
        console.log(`Applying ${file}...`);
        let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        if (file === '0006_seed_priya.sql') {
          // Phase D D.12 — gate the "did not match" warning on the actual
          // regex test, not on sql === before. The replace returns the
          // same string both when the regex didn't match AND when the
          // replacement value equals the original. The latter is the
          // common case on the 1st of the month (seed already says e.g.
          // '2026-05-01' and demoToday computes to '2026-05-01').
          const pattern = /v_demo_today date := '\d{4}-\d{2}-\d{2}'::date;/;
          if (!pattern.test(sql)) {
            console.warn('  ! v_demo_today substitution did not match. Seed will use its hardcoded value.');
          } else {
            sql = sql.replace(pattern, `v_demo_today date := '${demoToday}'::date;`);
            console.log(`  v_demo_today substituted to ${demoToday}`);
          }
        }
        await client.query(sql);
        console.log(`Applied ${file} successfully.`);
      }
    }
    
    console.log('All migrations applied successfully.');
  } catch (err) {
    console.error('Error applying migrations:', err);
  } finally {
    await client.end();
  }
}

applyMigrations();
