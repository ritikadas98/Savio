import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('=== Savio Chat Response Test ===\n');
  console.log('Logging in as Priya...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'priya@savio.demo',
    password: process.env.DEMO_PRIYA_PASSWORD || 'amanbabu@26'
  });

  if (authError || !authData.session) {
    console.error('Login failed:', authError);
    return;
  }

  const token = authData.session.access_token;
  console.log('Logged in. Token acquired.\n');

  const prompts = [
    "Can I afford a ₹5,000 watch?",
    "Am I on track for my phone fund?",
    "Should I invest in ELSS?",
    "What's my regret rate at Myntra?"
  ];

  const latencies: number[] = [];

  for (const p of prompts) {
    console.log(`--- TEST: "${p}" ---`);
    const start = performance.now();

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/chat-respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: p })
      });

      const json = await res.json();
      const latency = Math.round(performance.now() - start);
      latencies.push(latency);

      console.log(`Latency: ${latency}ms`);
      console.log('AI Metadata:', JSON.stringify(json.ai_metadata, null, 2));
      console.log('Response (first 200 chars):', json.response?.substring(0, 200));
      console.log('');
    } catch (err) {
      console.error('Error invoking function:', err);
    }
  }

  // Now test repeat latency (3 consecutive sends of same prompt)
  console.log('\n=== LATENCY CONSISTENCY TEST (3x same prompt) ===');
  const repeatPrompt = "What's my safe-to-spend?";
  const repeatLatencies: number[] = [];

  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/chat-respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: repeatPrompt })
      });
      const json = await res.json();
      const latency = Math.round(performance.now() - start);
      repeatLatencies.push(latency);
      console.log(`Run ${i + 1}: ${latency}ms | verified=${json.ai_metadata?.verified} | fallback=${json.ai_metadata?.fallback_used}`);
    } catch (err) {
      console.error('Error:', err);
    }
  }

  console.log('\n=== SUMMARY ===');
  const allLatencies = [...latencies, ...repeatLatencies];
  allLatencies.sort((a, b) => a - b);
  const median = allLatencies[Math.floor(allLatencies.length / 2)];
  const max = Math.max(...allLatencies);
  const min = Math.min(...allLatencies);
  console.log(`Prompts tested: ${allLatencies.length}`);
  console.log(`Min: ${min}ms | Median: ${median}ms | Max: ${max}ms`);
}

run();
