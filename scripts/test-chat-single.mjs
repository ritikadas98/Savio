import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const url     = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const svcKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pw      = process.env.DEMO_PRIYA_PASSWORD;

const userClient = createClient(url, anonKey);
const svc        = createClient(url, svcKey);

const { data: signIn } = await userClient.auth.signInWithPassword({ email: 'priya@savio.demo', password: pw });
const { data: profile } = await userClient.from('profiles').select('id').eq('auth_user_id', signIn.user.id).single();
await svc.from('chat_messages').delete().eq('user_id', profile.id);

const q = process.argv[2] || "What's my safe-to-spend?";
console.log(`Query: "${q}"`);

const { data, error } = await userClient.functions.invoke('chat-respond', { body: { message: q } });
if (error) { console.error('Function error:', error.message); }
console.log('Response:', JSON.stringify(data, null, 2));
process.exit(0);
