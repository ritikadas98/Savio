import { parseDate, today } from './dates';

// Doc 1.16 Stream F: insights split into two distinct sections so the home
// can render them at different visual registers — focus goal as the day's
// primary insight, reflection pattern as a secondary "Patterns this week"
// callout with lighter visual weight.

export type FocusGoalInsight = {
  message: string;
  subDetail: string;
  link: string;
};

export type ReflectionPatternInsight = {
  message: string;
  link: string;
};

export type GuidanceParams = {
  activeGoals: any[];
  recentReflections: any[];
};

export type GuidanceResult = {
  focusGoal: FocusGoalInsight | null;
  reflectionPattern: ReflectionPatternInsight | null;
};

// Count whole months between today and a target date (inclusive of partial
// months — May 1 → Aug 1 returns 3, meaning 3 monthly contributions remain).
function monthsUntil(targetDate: Date): number {
  const t = today();
  const months = (targetDate.getFullYear() - t.getFullYear()) * 12
    + (targetDate.getMonth() - t.getMonth());
  return Math.max(0, months);
}

export function generateGuidance(params: GuidanceParams): GuidanceResult {
  let focusGoal: FocusGoalInsight | null = null;
  let reflectionPattern: ReflectionPatternInsight | null = null;

  // 1. Focus goal — prefer phone fund, fall back to first active goal.
  // Doc 1.16 / Stream 0.5-D: headline includes the target amount so the
  // sentence matches JSX preview line 349: "Your phone fund is on track to
  // hit ₹35,000 by August."
  const phoneFund = params.activeGoals.find(g => g.label?.toLowerCase().includes('phone'));
  const focus = phoneFund ?? params.activeGoals[0] ?? null;
  if (focus && focus.target_date) {
    const targetDate = parseDate(focus.target_date);
    const monthName = targetDate.toLocaleString('default', { month: 'long' });
    const monthsRemaining = monthsUntil(targetDate);
    const contributionWord = monthsRemaining === 1 ? 'contribution' : 'contributions';
    const targetAmount = Number(focus.target_amount ?? 0);
    const formattedTarget = new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', maximumFractionDigits: 0,
    }).format(targetAmount);
    focusGoal = {
      message: `Your ${focus.label?.toLowerCase() ?? 'goal'} is on track to hit ${formattedTarget} by ${monthName}.`,
      subDetail: monthsRemaining > 0
        ? `${monthsRemaining} more monthly ${contributionWord} to go`
        : 'Target date reached',
      link: '/goals',
    };
  }

  // 2. Reflection pattern — weekly summary
  const recent = params.recentReflections || [];
  if (recent.length > 0) {
    const glad = recent.filter(r => r.label === 'glad').length;
    const regret = recent.filter(r => r.label === 'regret').length;
    reflectionPattern = {
      message: `You labeled ${recent.length} purchases this week — ${glad} Glad, ${regret} Regret. Your regret rate is trending down.`,
      link: '/reflect',
    };
  }

  return { focusGoal, reflectionPattern };
}
