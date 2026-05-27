// Phase B3: goal-status mapping.
//
// Spec Section 2.4 Option A: hardcode statuses per goal label. The JSX
// preview's status pills are design choices that anchored the visual
// presentation; algorithmic derivation off `last_contribution_date`
// (column doesn't exist in current schema) would produce noisier results
// and would diverge from the locked case-study story.
//
// V2 work: replace this map with a real derivation joining a
// goal_contributions ledger (or transactions tagged with goal_id). The
// case-study writeup acknowledges the MVP simplification and documents
// the production derivation path.

// Matches the literal union from src/components/primitives/Pill.tsx PillVariant.
type PillVariant = 'sage' | 'navy' | 'yellow' | 'red' | 'neutral';

export type GoalStatus = {
  status: string;
  variant: PillVariant;
};

const STATUS_BY_LABEL: Record<string, GoalStatus> = {
  'Phone fund':     { status: 'On track',       variant: 'sage' },
  'Emergency fund': { status: 'On track',       variant: 'sage' },
  'Goa trip':       { status: 'Behind 1 month', variant: 'yellow' },
};

const DEFAULT_STATUS: GoalStatus = { status: 'On track', variant: 'sage' };

export function getStatusFor(label: string): GoalStatus {
  return STATUS_BY_LABEL[label] ?? DEFAULT_STATUS;
}
