// D.49 (Stream 0.5t piece #5) — single source-of-truth for user rule
// values read on the frontend. Rules are stored on the profiles row as
// of migration 0019; this module wraps the read + fallback semantics so
// callers don't have to handle "profile not yet loaded" / "column null"
// edge cases inline.
//
// ⚠️ Mirror file: supabase/functions/_shared/user-rules.ts holds the
// Deno-side copy with the same RULE_DEFAULTS. Both files MUST stay in
// sync — the prompt_builder reads from the Deno copy when assembling
// chat grounding context, so any divergence reintroduces the drift bug
// that D.51 (Stream 0.5t side-finding 1) was meant to fix.

export const RULE_DEFAULTS = {
  safety_net: 100000,
  impulse_wait_threshold: 3000,
  impulse_wait_hours: 48,
  daily_sps_floor: 300,
} as const;

export type UserRules = {
  safety_net: number;
  impulse_wait_threshold: number;
  impulse_wait_hours: number;
  daily_sps_floor: number;
};

// Minimum profile shape this helper needs. Kept narrow so any caller with
// a partial profile object (e.g. mid-onboarding) can still use it.
type ProfileWithRules = {
  safety_net?: number | null;
  impulse_wait_threshold?: number | null;
  impulse_wait_hours?: number | null;
  daily_sps_floor?: number | null;
} | null | undefined;

export function getUserRules(profile: ProfileWithRules): UserRules {
  if (!profile) return { ...RULE_DEFAULTS };
  return {
    safety_net:             profile.safety_net             ?? RULE_DEFAULTS.safety_net,
    impulse_wait_threshold: profile.impulse_wait_threshold ?? RULE_DEFAULTS.impulse_wait_threshold,
    impulse_wait_hours:     profile.impulse_wait_hours     ?? RULE_DEFAULTS.impulse_wait_hours,
    daily_sps_floor:        profile.daily_sps_floor        ?? RULE_DEFAULTS.daily_sps_floor,
  };
}

// Display helpers — keep the rendered string single-source so the Profile
// UI and any future Rules edit surface render identically.
export function formatSafetyNet(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatImpulseWait(threshold: number, hours: number): string {
  return `${hours} hrs over ₹${(threshold / 1000).toLocaleString('en-IN')}K`;
}
