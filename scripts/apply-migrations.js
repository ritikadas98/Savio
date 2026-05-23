import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the connection string or password is provided
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:0EYo9h7X0852UrlZ@db.lstfbkcghnsoxyxpxnty.supabase.co:5432/postgres';

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

    const files = fs.readdirSync(migrationsDir).sort();
    
    for (const file of files) {
      if (file.endsWith('.sql')) {
        console.log(`Applying ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
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
