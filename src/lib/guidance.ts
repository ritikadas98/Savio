import { parseDate } from './dates';

export type GuidanceParams = {
  activeGoals: any[];
  recentReflections: any[];
};

export type GuidanceItem = {
  id: string;
  message: string;
  link: string;
};

export function generateGuidance(params: GuidanceParams): GuidanceItem[] {
  const items: GuidanceItem[] = [];

  // 1. Goal Progress
  const phoneFund = params.activeGoals.find(g => g.label?.toLowerCase().includes('phone'));
  if (phoneFund && phoneFund.target_date) {
    const date = parseDate(phoneFund.target_date);
    const month = date.toLocaleString('default', { month: 'long' });
    items.push({
      id: 'goal-phone',
      message: `Your phone fund is on track to hit target by ${month}`,
      link: '/goals'
    });
  } else if (params.activeGoals.length > 0) {
    items.push({
      id: 'goal-general',
      message: `You are making steady progress on your ${params.activeGoals.length} active goals.`,
      link: '/goals'
    });
  }

  // 2. Reflection Activity & Regret Rate
  const recent = params.recentReflections || [];
  if (recent.length > 0) {
    const glad = recent.filter(r => r.label === 'glad').length;
    const regret = recent.filter(r => r.label === 'regret').length;
    items.push({
      id: 'reflection-activity',
      message: `You labeled ${recent.length} purchases this week — ${glad} Glad, ${regret} Regret. Your regret rate is trending down.`,
      link: '/reflect'
    });
  } else {
    items.push({
      id: 'reflection-empty',
      message: `You haven't reviewed any recent purchases. Take a moment to reflect.`,
      link: '/reflect'
    });
  }

  return items;
}
