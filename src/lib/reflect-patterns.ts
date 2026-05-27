import { supabase } from './supabase';
import { formatRupeesIndian } from './formatters';
import type { ReflectionLabel } from './mood';

// Phase B2: pattern derivation across all of a user's reflections. Returns
// up to 3 narrative-line patterns surfaced from concentration in merchant,
// category, and overall regret-rate signals. Reflect surface renders these
// as a Card with hairline-divided lines.
//
// Operates on the full reflection history (not month-filtered) because the
// case-study payoff — "All 4 Myntra purchases marked regret" — only emerges
// once enough labels accumulate. For Priya's seed (9 reflections spread
// Nov 2025 → March 2026 per Doc 1.1), this surfaces meaningful patterns.

export type ReflectionWithTx = {
  id: string;
  label: ReflectionLabel;
  reflected_at: string;
  transaction_id: string;
  transactions: {
    merchant: string | null;
    category: string | null;
    amount: number;
    occurred_at: string;
  } | null;
};

export type Pattern = {
  label: string;
  body: string;
};

export async function fetchAllReflections(userId: string): Promise<ReflectionWithTx[]> {
  const { data, error } = await supabase
    .from('reflections')
    .select(`
      id, label, reflected_at, transaction_id,
      transactions:transaction_id (merchant, category, amount, occurred_at)
    `)
    .eq('user_id', userId)
    .order('reflected_at', { ascending: false });
  if (error) {
    console.error('[reflect-patterns] fetchAllReflections error:', error);
    return [];
  }
  return ((data ?? []) as unknown) as ReflectionWithTx[];
}

function groupBy<T>(items: T[], keyFn: (item: T) => string | null | undefined): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    if (!key) return acc;
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function countBy<T>(items: T[], keyFn: (item: T) => string | null | undefined): Record<string, number> {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

export function derivePatterns(reflections: ReflectionWithTx[]): Pattern[] {
  if (reflections.length === 0) {
    return [{
      label: 'No patterns yet —',
      body: 'label transactions above to start seeing what stands out.',
    }];
  }

  // Filter out reflections whose transaction row didn't join (defensive)
  const valid = reflections.filter(r => r.transactions != null);

  const patterns: Pattern[] = [];

  // Pattern 1: Merchant-level regret concentration
  const byMerchant = groupBy(valid, r => r.transactions?.merchant);
  for (const [merchant, items] of Object.entries(byMerchant)) {
    const regretCount = items.filter(i => i.label === 'regret').length;
    if (items.length >= 3 && regretCount === items.length) {
      patterns.push({
        label: `All ${items.length} ${merchant} purchases —`,
        body: `you marked every one regret. Consider unsubscribing from their notifications.`,
      });
    } else if (regretCount >= 2 && regretCount / items.length >= 0.6) {
      patterns.push({
        label: `${regretCount} of ${items.length} ${merchant} purchases —`,
        body: `marked regret. Most spending here pulls you off-track.`,
      });
    }
  }

  // Pattern 2: Category-level regret concentration
  const byCategory = groupBy(valid, r => r.transactions?.category);
  for (const [category, items] of Object.entries(byCategory)) {
    if (items.length < 3) continue;
    const regretItems = items.filter(i => i.label === 'regret');
    if (regretItems.length / items.length < 0.6) continue;
    const regretSum = regretItems.reduce((acc, i) => acc + Math.abs(Number(i.transactions?.amount ?? 0)), 0);
    patterns.push({
      label: `${category} —`,
      body: `${regretItems.length} of ${items.length} purchases marked regret. ${formatRupeesIndian(regretSum)} of avoidable spending across your history.`,
    });
  }

  // Pattern 3: Worth-it themes
  const worthItItems = valid.filter(r => r.label === 'glad');
  if (worthItItems.length >= 3) {
    const worthItCategories = countBy(worthItItems, i => i.transactions?.category);
    const sortedCats = Object.entries(worthItCategories).sort(([, a], [, b]) => b - a);
    const top = sortedCats[0];
    if (top && top[1] >= 2) {
      patterns.push({
        label: `${top[0]} —`,
        body: `your "worth it" category. ${top[1]} purchases here aligned with what matters to you.`,
      });
    }
  }

  // Pattern 4: Overall regret rate (only if reflections >= 5)
  if (valid.length >= 5) {
    const regretCount = valid.filter(r => r.label === 'regret').length;
    const rate = Math.round((regretCount / valid.length) * 100);
    if (rate >= 60) {
      patterns.push({
        label: `Your overall regret rate is ${rate}% —`,
        body: `across ${valid.length} labeled purchases. Worth pausing before similar future decisions.`,
      });
    } else if (rate <= 20) {
      patterns.push({
        label: `Your overall regret rate is ${rate}% —`,
        body: `across ${valid.length} labeled purchases. Your spending tends to match your intent.`,
      });
    }
  }

  if (patterns.length === 0) {
    patterns.push({
      label: 'Balanced patterns —',
      body: 'no concentrated regret or worth-it themes in your labels. Your spending looks considered.',
    });
  }

  return patterns.slice(0, 3);
}
