import { supabase } from './supabase';
import { formatRupeesIndian } from './formatters';
import { today } from './dates';
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

// =====================================================================
// B.18 (Stream 0.5p piece #7 — Path B) — per-merchant trend visualization
// =====================================================================
//
// Path B locked: bucket by transactions.occurred_at (purchase date), NOT
// reflections.reflected_at (label date). Pre-flight surfaced that seed
// reflections all carry the apply-migrations timestamp, which would
// produce hollow demo state with labeled_at bucketing. occurred_at
// answers the more product-relevant question ("how is your regret rate
// at this merchant changing over time") AND survives real-world
// labeling-behavior variance (users don't reliably label N days after
// purchase). PM_DECISIONS B.18 captures this.
//
// Window: "last 30 days from DEMO_TODAY" for the current period vs
// "30-120 days ago" for the prior 3-month average. Best match to the
// section subtitle "Recent purchases vs prior 3 months".
//
// Stripe color rules (in precedence order):
//   1. current regret rate >= 70%               → RED
//   2. delta > 0 (worsening) AND current >= 40% → RED
//   3. delta < 0 (improving)                    → SAGE
//   4. first-period (no comparable prior) OR
//      delta == 0 at moderate level             → GRAY
//
// Delta color rules:
//   - negative (improving)        → DARK GREEN
//   - positive (worsening)        → DARK RED
//   - zero (flat)                 → NEUTRAL GRAY
//   - null (first-period, em-dash) → LIGHT GRAY

export type MerchantTrend = {
  merchant: string;
  reflectionCount: number;             // total reflections at this merchant
  currentCount: number;                // reflections with occurred_at in last 30d
  priorCount: number;                  // reflections with occurred_at in 30-120d ago
  currentRegretRate: number | null;    // 0-100, null when currentCount === 0
  priorRegretRate: number | null;      // 0-100, null when priorCount < 2 (insufficient prior data)
  delta: number | null;                // percentage-point change, null when either rate is null
  stripeColor: string;                 // hex
  deltaColor: string;                  // hex
  deltaLabel: string;                  // formatted: "-17%" / "0%" / "+8%" / "—"
  recentReflections: {                 // most recent N (descending) for tap-to-expand
    amount: number;
    occurred_at: string;
    label: ReflectionLabel;
  }[];
};

const STRIPE_RED   = '#A32D2D';
const STRIPE_SAGE  = '#3B6D11';
const STRIPE_GRAY  = '#D3D1C7';

const DELTA_GREEN  = '#173404';
const DELTA_RED    = '#501313';
const DELTA_NEUTRAL = '#5F5E5A';
const DELTA_LIGHT  = '#888880';

const MS_DAY = 86_400_000;
const CURRENT_WINDOW_DAYS = 30;
const PRIOR_WINDOW_DAYS = 90;
const MIN_PRIOR_FOR_COMPARISON = 2;

function regretRate(reflections: { label: ReflectionLabel }[]): number | null {
  if (reflections.length === 0) return null;
  const regrets = reflections.filter(r => r.label === 'regret').length;
  return Math.round((regrets / reflections.length) * 100);
}

function pickStripeColor(currentRate: number | null, delta: number | null): string {
  // Rule 1: persistent high regret stays red regardless of trend
  if (currentRate != null && currentRate >= 70) return STRIPE_RED;
  // Rule 2: worsening at moderate+ level
  if (delta != null && delta > 0 && currentRate != null && currentRate >= 40) return STRIPE_RED;
  // Rule 3: improving
  if (delta != null && delta < 0) return STRIPE_SAGE;
  // Rule 4: everything else (flat, first-period, or moderate level)
  return STRIPE_GRAY;
}

function pickDeltaColor(delta: number | null): string {
  if (delta == null) return DELTA_LIGHT;
  if (delta < 0) return DELTA_GREEN;
  if (delta > 0) return DELTA_RED;
  return DELTA_NEUTRAL;
}

function formatDelta(delta: number | null): string {
  if (delta == null) return '—';
  if (delta === 0) return '0%';
  return delta > 0 ? `+${delta}%` : `${delta}%`;
}

export function computeMerchantTrends(reflections: ReflectionWithTx[]): MerchantTrend[] {
  const valid = reflections.filter(r => r.transactions != null && r.transactions.merchant);
  const now = today().getTime();
  const currentStart = now - CURRENT_WINDOW_DAYS * MS_DAY;
  const priorStart   = now - (CURRENT_WINDOW_DAYS + PRIOR_WINDOW_DAYS) * MS_DAY;
  const priorEnd     = currentStart;

  const byMerchant: Record<string, ReflectionWithTx[]> = {};
  for (const r of valid) {
    const m = r.transactions!.merchant!;
    (byMerchant[m] ||= []).push(r);
  }

  const trends: MerchantTrend[] = [];
  for (const [merchant, refs] of Object.entries(byMerchant)) {
    const currentRefs = refs.filter(r => {
      const t = new Date(r.transactions!.occurred_at).getTime();
      return t >= currentStart && t < now;
    });
    const priorRefs = refs.filter(r => {
      const t = new Date(r.transactions!.occurred_at).getTime();
      return t >= priorStart && t < priorEnd;
    });

    const currentRegretRate = regretRate(currentRefs);
    const priorRegretRate = priorRefs.length >= MIN_PRIOR_FOR_COMPARISON
      ? regretRate(priorRefs)
      : null;
    const delta = (currentRegretRate != null && priorRegretRate != null)
      ? Math.round(currentRegretRate - priorRegretRate)
      : null;

    const stripeColor = pickStripeColor(currentRegretRate, delta);
    const deltaColor = pickDeltaColor(delta);
    const deltaLabel = formatDelta(delta);

    const recentReflections = refs
      .slice()
      .sort((a, b) => new Date(b.transactions!.occurred_at).getTime() - new Date(a.transactions!.occurred_at).getTime())
      .slice(0, 5)
      .map(r => ({
        amount: Number(r.transactions!.amount),
        occurred_at: r.transactions!.occurred_at,
        label: r.label,
      }));

    trends.push({
      merchant,
      reflectionCount: refs.length,
      currentCount: currentRefs.length,
      priorCount: priorRefs.length,
      currentRegretRate,
      priorRegretRate,
      delta,
      stripeColor,
      deltaColor,
      deltaLabel,
      recentReflections,
    });
  }

  // Card ordering: most data first
  return trends.sort((a, b) => b.reflectionCount - a.reflectionCount);
}

// =====================================================================
// D.43 (Stream 0.5s pieces #5 + #6) — aggregate emotion trend chart
// =====================================================================
//
// Replaces per-merchant cards as the primary Reflect post-generation
// surface. Three lines (worth-it / regret / neutral) over the last 6
// months, percentage of each month's total reflections. Bucket by
// transaction.occurred_at per B.18 Path B. Headline interpretation
// computed from the same chart data.

export type MonthlyEmotionPoint = {
  month: string;        // "Dec", "Jan", "Feb", "Mar", "Apr", "May"
  monthDate: Date;      // start-of-month, for sorting + tooltip
  worthIt: number;      // count of 'glad' labels with occurred_at in month
  regret: number;       // count of 'regret' labels in month
  neutral: number;      // count of 'neutral' labels in month
  total: number;        // sum (drives % computation)
};

export type EmotionChartData = MonthlyEmotionPoint[];

export type EmotionHeadline = {
  // Pre/post-emphasis text plus the emphasis word + color so the consumer
  // can render with an inline-accent span without re-parsing the string.
  prefix: string;
  emphasis: string | null;
  emphasisColor: string;
  suffix: string;
};

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function computeLast6MonthStarts(demoToday: Date): Date[] {
  // Returns 6 month-start Date objects, oldest first, ending at the month
  // containing demoToday. For DEMO_TODAY = 2026-05-01 returns:
  //   [Dec 1 2025, Jan 1 2026, Feb 1 2026, Mar 1 2026, Apr 1 2026, May 1 2026]
  const out: Date[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(demoToday.getFullYear(), demoToday.getMonth() - i, 1);
    out.push(d);
  }
  return out;
}

function isInMonth(occurred: Date, monthStart: Date): boolean {
  return occurred.getFullYear() === monthStart.getFullYear()
      && occurred.getMonth()   === monthStart.getMonth();
}

export function computeMonthlyEmotionTrend(
  reflections: ReflectionWithTx[],
  demoToday: Date,
): EmotionChartData {
  const valid = reflections.filter(r => r.transactions != null);
  const monthStarts = computeLast6MonthStarts(demoToday);

  return monthStarts.map(monthStart => {
    let worthIt = 0;
    let regret = 0;
    let neutral = 0;
    for (const r of valid) {
      const occurred = new Date(r.transactions!.occurred_at);
      if (!isInMonth(occurred, monthStart)) continue;
      if (r.label === 'glad') worthIt++;
      else if (r.label === 'regret') regret++;
      else if (r.label === 'neutral') neutral++;
    }
    return {
      month: SHORT_MONTHS[monthStart.getMonth()],
      monthDate: monthStart,
      worthIt,
      regret,
      neutral,
      total: worthIt + regret + neutral,
    };
  });
}

// Color constants mirror the chart's line colors so the headline emphasis
// word matches its line visually. Kept inline rather than in design-tokens
// because they're tightly bound to the Path B stripe palette (sage = good
// trajectory, red = regret-dominant).
const HEADLINE_SAGE    = '#3B6D11';
const HEADLINE_RED     = '#A32D2D';
const HEADLINE_NEUTRAL = '#5A6B5F';

function sumEmotion(points: EmotionChartData, key: 'worthIt' | 'regret' | 'neutral'): number {
  return points.reduce((sum, p) => sum + p[key], 0);
}

function sumTotal(points: EmotionChartData): number {
  return points.reduce((sum, p) => sum + p.total, 0);
}

// D.45 (Stream 0.5s post-ship patch) — switched from absolute-count
// comparison to rate-based comparison. The previous count math biased
// the headline: any user whose reflection volume grew over time (a
// realistic usage curve) would show positive worthItChange purely
// from volume, not from actual rate improvement. Rate-based logic
// answers "is regret a SMALLER SHARE of recent reflections than it
// was?" — which is the question the headline implicitly claims to
// answer.
//
// Branch ordering also reshuffled: strong-improving / strong-worsening
// are now checked before crossover. Crossover is a weaker signal —
// "recent worth-it is bigger than recent regret" can be true without
// any real direction-of-change information. The dual-rate-delta tests
// (>10pp improvement AND >10pp worsening of regret simultaneously)
// are stricter and read as "actually trending" rather than just
// "currently leaning."
//
// Threshold: 0.10 (10 percentage points) — gates out small-sample
// noise. A 3-of-10 → 4-of-10 shift on its own isn't enough to claim
// a trend; needs to pair with the opposite emotion moving too.
const SIGNIFICANT_RATE_CHANGE = 0.10;

export function deriveEmotionHeadline(data: EmotionChartData): EmotionHeadline {
  const total = sumTotal(data);

  if (total < 5) {
    return { prefix: 'Not enough data yet — keep reflecting', emphasis: null, emphasisColor: HEADLINE_NEUTRAL, suffix: '' };
  }

  // Recent = last 2 months; older = first 2 months. Tracks directional
  // change at the edges of the 6-month window — middle months smooth out.
  const recent = data.slice(-2);
  const older  = data.slice(0, 2);
  const recentTotal = sumTotal(recent);
  const olderTotal  = sumTotal(older);

  // D.45 — if either window has zero reflections, the rate is undefined.
  // Fall back to "not enough data" rather than dividing by zero or making
  // a claim from one-sided data.
  if (recentTotal === 0 || olderTotal === 0) {
    return { prefix: 'Not enough data yet — keep reflecting', emphasis: null, emphasisColor: HEADLINE_NEUTRAL, suffix: '' };
  }

  const recentWorthItRate = sumEmotion(recent, 'worthIt') / recentTotal;
  const recentRegretRate  = sumEmotion(recent, 'regret')  / recentTotal;
  const olderWorthItRate  = sumEmotion(older, 'worthIt')  / olderTotal;
  const olderRegretRate   = sumEmotion(older, 'regret')   / olderTotal;

  const worthItRateChange = recentWorthItRate - olderWorthItRate;
  const regretRateChange  = recentRegretRate  - olderRegretRate;

  // Strong improving: worth-it rate up AND regret rate down, both
  // beyond the noise threshold.
  if (worthItRateChange > SIGNIFICANT_RATE_CHANGE && regretRateChange < -SIGNIFICANT_RATE_CHANGE) {
    return { prefix: "You're trending toward ", emphasis: 'worth-it', emphasisColor: HEADLINE_SAGE, suffix: '' };
  }

  // Strong worsening: regret rate up AND worth-it rate down.
  if (regretRateChange > SIGNIFICANT_RATE_CHANGE && worthItRateChange < -SIGNIFICANT_RATE_CHANGE) {
    return { prefix: '', emphasis: 'Regret', emphasisColor: HEADLINE_RED, suffix: ' is dominating recently' };
  }

  // Crossover — recent worth-it leads regret AND the older window was
  // the opposite. Weaker than the dual-delta signals above (no rate-
  // change magnitude requirement), so checked after them.
  if (recentWorthItRate > recentRegretRate && olderRegretRate > olderWorthItRate) {
    return { prefix: "Worth-it is overtaking ", emphasis: 'regret', emphasisColor: HEADLINE_RED, suffix: '' };
  }

  // Stable patterns — recent dominance by 1.5× on rate (not count).
  if (recentRegretRate > recentWorthItRate * 1.5) {
    return { prefix: '', emphasis: 'Regret', emphasisColor: HEADLINE_RED, suffix: ' still dominates your reflections' };
  }
  if (recentWorthItRate > recentRegretRate * 1.5) {
    return { prefix: '', emphasis: 'Worth-it', emphasisColor: HEADLINE_SAGE, suffix: ' leads your recent reflections' };
  }

  return { prefix: 'Mixed signals — patterns are varying', emphasis: null, emphasisColor: HEADLINE_NEUTRAL, suffix: '' };
}
