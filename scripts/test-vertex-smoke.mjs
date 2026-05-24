import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data: signIn } = await sb.auth.signInWithPassword({ email: 'priya@savio.demo', password: process.env.DEMO_PRIYA_PASSWORD });
if (!signIn) { console.error('Sign-in failed'); process.exit(1); }

console.log('Calling gemini-test (Vertex AI cold-path)…');
const start = Date.now();
const { data, error } = await sb.functions.invoke('gemini-test', { body: { prompt: 'Say hello in 5 words.' } });
const elapsed = Date.now() - start;
if (error) { console.error('Error:', error.message); process.exit(1); }
console.log(`Response: ${JSON.stringify(data, null, 2)}`);
console.log(`Wall time: ${elapsed}ms (includes JWT mint + token exchange on cold start)`);
