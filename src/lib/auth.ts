import { supabase } from './supabase';

// Phase C4 — single source of truth for the demo-login path. Pre-C4, the
// loginAsPriya call was inline in WelcomePage. C4's Interstitial screen
// needs the same path; extracting here avoids duplicating credentials.

export const PRIYA_EMAIL = 'priya@savio.demo';

function priyaPassword(): string {
  // Vite injects VITE_-prefixed env vars into the bundle; we keep the
  // fallback only because the demo originally shipped with it.
  return import.meta.env.VITE_DEMO_PRIYA_PASSWORD || 'amanbabu@26';
}

export async function loginAsPriya(): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: PRIYA_EMAIL,
    password: priyaPassword(),
  });
  if (error) throw error;
}
