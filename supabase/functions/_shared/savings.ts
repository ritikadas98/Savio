// D.65 (Stream 0.5z Spec 2) — Deno-side mirror of src/lib/savings.ts.
// Used by chat-respond/prompt_builder.ts to inject the cushion + floor
// status into chat grounding so Spec 3's buffer-aware verdicts have the
// data they need.
//
// ⚠️ Mirror file: src/lib/savings.ts holds the browser-side copy with
// the same formula. Both files MUST stay in sync —
// tests/unit/savings-parity.test.ts will catch any drift.

const RULE_DEFAULT_SAFETY_NET = 100000;

export type SavingsState = {
  unearmarkedLiquid: number;
  safetyNet: number;
  backerLabel: string | null;
  backerBalance: number;
  cushion: number;
  floorCovered: boolean;
  rebuildGap: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSavingsState(profile: any, goals: any[] | null | undefined): SavingsState {
  const unearmarkedLiquid = Number(profile?.unearmarked_liquid ?? 0);
  const safetyNet = Number(profile?.safety_net ?? RULE_DEFAULT_SAFETY_NET);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const backer = (goals ?? []).find((g: any) => g?.backs_safety_net === true);
  const backerBalance = Number(backer?.current_amount ?? 0);
  const backerLabel = backer?.label ?? null;

  const floorDrag = Math.max(0, safetyNet - backerBalance);
  const cushion = Math.max(0, unearmarkedLiquid - floorDrag);

  const totalAccessibleLiquid = backerBalance + unearmarkedLiquid;
  const floorCovered = totalAccessibleLiquid >= safetyNet;
  const rebuildGap = Math.max(0, safetyNet - totalAccessibleLiquid);

  return { unearmarkedLiquid, safetyNet, backerLabel, backerBalance, cushion, floorCovered, rebuildGap };
}
