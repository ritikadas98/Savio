import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data: signIn, error: signErr } = await sb.auth.signInWithPassword({
  email: 'priya@savio.demo',
  password: process.env.DEMO_PRIYA_PASSWORD,
});
if (signErr) { console.error('Sign-in:', signErr); process.exit(1); }

const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/gemini-test`;
const res = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${signIn.session.access_token}`,
    apikey: process.env.VITE_SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ prompt: 'Say hello in 5 words.' }),
});
console.log('HTTP status:', res.status);
console.log('Body:', await res.text());
