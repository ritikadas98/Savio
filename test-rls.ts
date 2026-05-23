import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('=== Savio RLS Context Test ===\n');
  console.log('Logging in as Priya...');
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'priya@savio.demo',
    password: process.env.DEMO_PRIYA_PASSWORD || 'amanbabu@26'
  });

  if (authError || !authData.session) {
    console.error('Login failed:', authError);
    return;
  }

  console.log('Logged in successfully. Auth context established.\n');

  // To prove RLS works under authenticated context, we query using the same client
  // The client automatically attaches the Auth header now.

  const { count: commitmentsCount, error: cErr } = await supabase
    .from('commitments')
    .select('*', { count: 'exact', head: true });
    
  if (cErr) console.error('Commitments error:', cErr);
  console.log(`SELECT COUNT(*) FROM commitments: ${commitmentsCount}`);

  const { count: goalsCount, error: gErr } = await supabase
    .from('goals')
    .select('*', { count: 'exact', head: true });

  if (gErr) console.error('Goals error:', gErr);
  console.log(`SELECT COUNT(*) FROM goals: ${goalsCount}`);

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('auth_user_id', authData.user.id)
    .single();

  if (pErr) console.error('Profiles error:', pErr);
  console.log(`SELECT full_name FROM profiles: ${profile?.full_name}`);
  
  console.log('\n=== TEST COMPLETE ===');
}

run();
