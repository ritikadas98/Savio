// Phase C4 — deterministic fallback for the Step 8 Ready synthesis. Matches
// the discipline of 0.5j's Reflect-pattern fallback: AI tries first, falls
// back silently to a template if it fails. User never sees an error.

import { ordinalSuffix } from './formatters';

export interface SynthesisInputs {
  avatar: 'strategist' | 'adventurer' | 'builder' | null;
  lifeStage: 'student' | 'working_no_dependents' | 'supporting_dependents' | 'pre_retiree' | null;
  anchorDay: number | null;          // resolved numeric day (1-28)
  focusGoalLabel: string | null;     // null = "no specific focus"
  monthlyIncome: number | null;      // rounded to nearest 1000 client-side
}

const AVATAR_OPENERS: Record<'strategist' | 'adventurer' | 'builder', string> = {
  strategist: "Here's where you stand:",
  adventurer: "Here's what we've mapped together:",
  builder:    "Here's the structure we have:",
};

const STAGE_PHRASES: Record<
  'student' | 'working_no_dependents' | 'supporting_dependents' | 'pre_retiree',
  string
> = {
  student:                'as a student',
  working_no_dependents:  'working without dependents',
  supporting_dependents:  'supporting dependents',
  pre_retiree:            'planning for retirement',
};

export function fallbackSynthesis(inputs: SynthesisInputs): string {
  const opener   = AVATAR_OPENERS[inputs.avatar ?? 'strategist'];
  const stage    = STAGE_PHRASES[inputs.lifeStage ?? 'working_no_dependents'];
  const dayLabel = ordinalSuffix(inputs.anchorDay ?? 1);
  const focusLine = inputs.focusGoalLabel
    ? ` You're focused on ${inputs.focusGoalLabel} this month.`
    : " You're keeping your options open this month.";
  return `${opener} ${stage}, with monthly check-ins on the ${dayLabel}.${focusLine} The first check-in is up next.`;
}
