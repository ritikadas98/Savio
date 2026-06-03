// D.65 (Stream 0.5z Spec 2) — savings + cushion derivation. Single
// source-of-truth for the spendable-cushion concept that Spec 3's
// buffer-aware verdicts consume. Mirrors the D.49 pattern: one module,
// one formula, two surfaces (Profile UI + chat grounding) both reading
// from here so the figures can't drift.
//
// ⚠️ Mirror file: supabase/functions/_shared/savings.ts holds the
// Deno-side copy with the same formula. Both files MUST stay in sync —
// any drift will be caught by tests/unit/savings-parity.test.ts.
//
// THE MODEL
// ─────────
// safety_net (rule)         A line, not money: "never let accessible liquid
//                           drop below this amount." (Default ₹1,00,000.)
// emergency-fund goal       A regular goal that's been *flagged* as backing
//   (backs_safety_net=true) the safety net — i.e., its current_amount is
//                           what conceptually covers the floor.
// unearmarked_liquid        Stated balance not earmarked to any goal. The
//                           ONLY spendable cushion.
//
// THE FORMULA (why it's not just `unearmarked − safety_net`)
// ──────────────────────────────────────────────────────────
// Naïve subtraction overcounts the floor: if the EF already covers the
// safety-net amount, the user's unearmarked liquid is fully spendable
// above the floor — the EF is what's "holding the line." Only when the
// EF falls short does unearmarked have to plug the gap.
//
//   floor_drag = max(0, safety_net − emergency_fund_backer_balance)
//   cushion    = max(0, unearmarked_liquid − floor_drag)
//
// For Priya: EF ₹1,84,000 > safety_net ₹1,00,000 → floor_drag = 0 →
// cushion = unearmarked = ₹50,000.  ✓ matches Spec 2's verification gate.
//
// FLOOR-COVERAGE PRESENTATION
// ───────────────────────────
// "Floor covered" = (EF_balance + unearmarked_liquid) ≥ safety_net. When
// this is false, the Profile surface renders a rebuild gap rather than a
// negative cushion (reuse D.62 deficit_breached framing).

import { RULE_DEFAULTS } from './user-rules';

export type SavingsState = {
  unearmarkedLiquid: number;
  safetyNet: number;
  /** Label of the goal flagged backs_safety_net=true (e.g. "Emergency fund"). null if no backer flagged. */
  backerLabel: string | null;
  /** current_amount of the backer goal. 0 if no backer flagged. */
  backerBalance: number;
  /** max(0, unearmarked − max(0, safety_net − backerBalance)) */
  cushion: number;
  /** (backerBalance + unearmarkedLiquid) >= safety_net */
  floorCovered: boolean;
  /** max(0, safety_net − (backerBalance + unearmarkedLiquid)). 0 when floor covered. */
  rebuildGap: number;
};

type GoalLike = {
  label?: string | null;
  current_amount?: number | null;
  backs_safety_net?: boolean | null;
};

type ProfileLike = {
  unearmarked_liquid?: number | null;
  safety_net?: number | null;
} | null | undefined;

export function getSavingsState(
  profile: ProfileLike,
  goals: GoalLike[] | null | undefined,
): SavingsState {
  const unearmarkedLiquid = Number(profile?.unearmarked_liquid ?? 0);
  const safetyNet = Number(profile?.safety_net ?? RULE_DEFAULTS.safety_net);

  // The schema's partial unique index (migration 0022) guarantees ≤ 1 row;
  // `find` returns the first match or undefined.
  const backer = (goals ?? []).find(g => g?.backs_safety_net === true);
  const backerBalance = Number(backer?.current_amount ?? 0);
  const backerLabel = backer?.label ?? null;

  const floorDrag = Math.max(0, safetyNet - backerBalance);
  const cushion = Math.max(0, unearmarkedLiquid - floorDrag);

  const totalAccessibleLiquid = backerBalance + unearmarkedLiquid;
  const floorCovered = totalAccessibleLiquid >= safetyNet;
  const rebuildGap = Math.max(0, safetyNet - totalAccessibleLiquid);

  return { unearmarkedLiquid, safetyNet, backerLabel, backerBalance, cushion, floorCovered, rebuildGap };
}
