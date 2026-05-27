import { today } from './dates';

// Stream 0.5-H: compute the next-4 upcoming fixed commitments by their
// due_day_of_month within a 14-day window from today.
//
// Spec deviation note: master plan / Stream 0.5-H prescribed a hardcoded
// FIXED_COMMITMENT_NAMES list with a TODO pointing at Migration 0012
// (which would add an `is_fixed` boolean column). We already have the
// equivalent column from Doc 1.1's schema — `commitments.kind` is a
// 'fixed' | 'variable' text discriminant. So this helper queries by
// `kind = 'fixed'` directly. When Migration 0012 lands with `is_fixed`,
// the kind column may get retired or kept as a richer discriminant; the
// query here is the single place to flip.

export type Commitment = {
  id: string;
  label: string;
  amount: number;
  due_day_of_month: number | null;
  category: string | null;
  kind: 'fixed' | 'variable';
};

export type UpcomingBill = {
  id: string;
  label: string;
  amount: number;
  due_day_of_month: number;
  category: string | null;
  /** Pre-formatted relative copy: "Due today" / "Due tomorrow" / "Due in N days". */
  dueRelative: string;
};

export function computeUpcomingBills(commitments: Commitment[], windowDays = 14, limit = 4): UpcomingBill[] {
  const t = today();
  const todayDay = t.getDate();
  const endDay = Math.min(todayDay + windowDays, 31);

  return commitments
    .filter(c => c.kind === 'fixed' && c.due_day_of_month != null
      && c.due_day_of_month >= todayDay && c.due_day_of_month <= endDay)
    .sort((a, b) => (a.due_day_of_month ?? 0) - (b.due_day_of_month ?? 0))
    .slice(0, limit)
    .map(c => {
      const day = c.due_day_of_month!;
      const diff = day - todayDay;
      let dueRelative: string;
      if (diff === 0) dueRelative = 'Due today';
      else if (diff === 1) dueRelative = 'Due tomorrow';
      else dueRelative = `Due in ${diff} days`;
      return {
        id: c.id,
        label: c.label,
        amount: Number(c.amount),
        due_day_of_month: day,
        category: c.category,
        dueRelative,
      };
    });
}
