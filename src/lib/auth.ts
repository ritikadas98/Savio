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

// D.21 (Stream 0.5p piece #1) — sign-out path. Real-user testing surfaced
// that there was no way to leave the demo session within the app. This
// mirrors loginAsPriya's structure: clear localStorage hints first
// (presentation-layer state — onboarding-derived avatar + life-stage),
// then call supabase.auth.signOut(). localStorage clears go first so a
// signOut failure still leaves the user in a coherent state. Both
// localStorage and signOut errors are non-fatal — the caller catches and
// surfaces; we don't want a transient network blip to silently leave the
// user logged in.
export async function logoutFromPriya(): Promise<void> {
  try {
    localStorage.removeItem('savio_demo_avatar');
    localStorage.removeItem('savio_demo_life_stage');
  } catch (err) {
    console.warn('[auth] localStorage clear during logout failed (non-fatal)', err);
  }

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function loginAsPriya(): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: PRIYA_EMAIL,
    password: priyaPassword(),
  });
  if (error) throw error;

  // Phase D-followup: after every successful demo login, ping the
  // cooldown-gated maybe_reset_demo RPC. If the demo hasn't been
  // reset in the last 60 minutes, this restores Priya to canonical
  // state (wipes chat / windfall allocations / May ritual /
  // saved_decisions / non-seed reflections, reverts goal mutations
  // from any prior rollover allocations). Within the cooldown window
  // it's a cheap no-op. Non-fatal on error — the login itself
  // already succeeded.
  try {
    await supabase.rpc('maybe_reset_demo');
  } catch (err) {
    console.warn('[auth] maybe_reset_demo failed (non-fatal)', err);
  }
}
