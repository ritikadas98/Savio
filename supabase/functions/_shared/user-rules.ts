// D.49 (Stream 0.5t piece #5) — Deno-side mirror of src/lib/user-rules.ts.
// Used by chat-respond/prompt_builder.ts to read rule values off the
// profile row when assembling chat grounding context.
//
// ⚠️ Mirror file: src/lib/user-rules.ts holds the browser-side copy with
// the same RULE_DEFAULTS. Both files MUST stay in sync — divergence
// reintroduces the drift bug that D.51 (Stream 0.5t side-finding 1) was
// meant to fix. Edge Functions can't import from src/ because they run
// in Deno; the duplication is structural, not avoidable.

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getUserRulesFromProfile(profile: any): UserRules {
  if (!profile) return { ...RULE_DEFAULTS };
  return {
    safety_net:             Number(profile.safety_net             ?? RULE_DEFAULTS.safety_net),
    impulse_wait_threshold: Number(profile.impulse_wait_threshold ?? RULE_DEFAULTS.impulse_wait_threshold),
    impulse_wait_hours:     Number(profile.impulse_wait_hours     ?? RULE_DEFAULTS.impulse_wait_hours),
    daily_sps_floor:        Number(profile.daily_sps_floor        ?? RULE_DEFAULTS.daily_sps_floor),
  };
}
