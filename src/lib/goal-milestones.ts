import { Shield, Trophy, type LucideIcon } from 'lucide-react';

// Phase B3: per-goal milestone callouts.
//
// Spec Section 2.5: hardcoded per goal label for MVP demo. Behind goals
// (Goa trip) get no callout — celebration framing fits "On track" goals
// only.
//
// V2 work: derive milestones from `saved_decisions` (decline events →
// "Declined X — protected this by ~N months") + a streak detection
// pass on goal_contributions ("N months hitting savings target").
// Banked in PM_DECISIONS B.7.

export type Milestone = {
  icon: LucideIcon;
  text: string;
};

const MILESTONES: Record<string, Milestone | null> = {
  'Phone fund': {
    icon: Shield,
    text: 'Declined AirPods — protected this by ~6 months',
  },
  'Emergency fund': {
    icon: Trophy,
    text: '4 months hitting your savings target',
  },
  'Goa trip': null,
};

export function getMilestoneFor(label: string): Milestone | null {
  return MILESTONES[label] ?? null;
}
