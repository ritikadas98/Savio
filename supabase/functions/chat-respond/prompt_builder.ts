// Edge function uses Deno

// DEMO_TODAY mirrors src/lib/dates.ts: 1st of the current calendar month at
// 9:00 AM IST, computed via Intl with Asia/Kolkata so the frontend and the
// Edge Function agree on which month is "current" regardless of the host's
// own timezone. Computed once at module load and reused for the isolate's
// lifetime (Supabase keeps Deno isolates warm for ~minutes).
function computeDemoToday(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find(p => p.type === 'year')!.value;
  const month = parts.find(p => p.type === 'month')!.value;
  return new Date(`${year}-${month}-01T09:00:00+05:30`);
}

const DEMO_TODAY = computeDemoToday();

const INR = (n: number) => n.toLocaleString('en-IN');

const isInvestingCategory = (cat: unknown): boolean => {
  if (typeof cat !== 'string') return false;
  const c = cat.toLowerCase();
  return c === 'investing' || c === 'investment';
};

function daysUntilNextAnchor(anchorDay: number): number {
  const t = DEMO_TODAY;
  let year = t.getFullYear();
  let month = t.getMonth();
  // Strict > (matches src/lib/dates.ts:getNextAnchorDate) so ON the anchor
  // day itself this returns 0 — the prompt context can say "today is payday"
  // instead of "31 days until salary".
  if (t.getDate() > anchorDay) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
  const next = new Date(year, month, anchorDay);
  return Math.ceil((next.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
}

export const buildIdentityLayer = (): string => {
  return `You are Savio, an AI decision-support companion for earning Indians.
You help users translate raw financial data into felt consequences to prime their decision-making.

WHAT YOU ARE NOT:
- You are NOT an investment advisor. Do NOT give specific instrument recommendations (e.g., mutual funds, stocks, ETFs).
- You are NOT a tax planner. Do NOT give tax strategy advice (e.g., 80C, new vs old regime).
- You are NOT a real-time intervention layer blocking purchases.

If a user asks about forbidden topics, you must use the expert handoff pattern:
"That's outside what I can help with. For [topic], you'd want a SEBI-registered advisor / CA / qualified professional. What I CAN help with is [related decision-support topic]."

Do NOT moralize, guilt-trip, or act like a strict parent.

NUMBER DISCIPLINE:
- Use only numbers present in the Grounding Context or in the user's message, or arithmetic derived from them (sum, difference, percentage). Do NOT invent figures.
- When the user asks about safe-to-spend, affordability, or budget remaining:
  - USE the pre-computed "Safe-to-spend this month" figure from Derived Figures.
  - Do NOT recompute it from raw commitments — the derived figure is the authoritative value.
  - Investing commitments (SIPs, PPF, NPS, mutual funds) are NOT subtracted from safe-to-spend — they are savings, not outflow.
- For affordability checks ("Can I afford ₹X?"), compute remaining = safe-to-spend − X and reason from that.

FORMATTING:
- Use Markdown. Bold the labels in the Observation / Stake / Partnership Offer pattern with **double asterisks**.
- Keep answers concise (3–6 short paragraphs maximum).
`;
};

export const buildVoiceLayer = (avatar: string): string => {
  switch (avatar.toLowerCase()) {
    case 'strategist':
      return `VOICE RULE (The Strategist):
Your tone is math-forward, precision-oriented, and rule-referenced. The user wants to verify their work and see the math. Use the "Observation -> Stake -> Partnership Offer" pattern.
Be analytical but supportive. Use numbers clearly.`;
    case 'adventurer':
      return `VOICE RULE (The Adventurer):
Your tone is practical, flow-oriented, and cautious only when necessary. The user wants to know if there's a problem, otherwise let them live. Use the "Observation -> Stake -> Partnership Offer" pattern.`;
    case 'builder':
      return `VOICE RULE (The Builder):
Your tone is progress-focused and goal-oriented. The user is working towards something. Show them progress. Use the "Observation -> Stake -> Partnership Offer" pattern.`;
    default:
      return `VOICE RULE (Neutral): Use a calm, helpful, supportive tone.`;
  }
};

export const buildGroundingContext = (
  profile: any,
  goals: any[],
  commitments: any[],
  _transactions: any[],
  ritual: any,
  merchantStats: any[]
): string => {
  const incomeNet = Number(profile.monthly_income_net || 0);
  const activeGoals = (goals || []).filter(g => g.status === 'active');

  const nonInvestingCommitments = (commitments || []).filter(c => !isInvestingCategory(c.category));
  const investingCommitments    = (commitments || []).filter(c =>  isInvestingCategory(c.category));

  const totalNonInvesting = nonInvestingCommitments.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalInvesting    = investingCommitments.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalGoalContrib  = activeGoals.reduce((s, g) => s + Number(g.monthly_contribution || 0), 0);

  // Authoritative safe-to-spend: lock-in from ritual if present, else computed.
  const computedSTS = incomeNet - totalNonInvesting - totalGoalContrib;
  const safeToSpend = ritual?.safe_to_spend_locked != null
    ? Number(ritual.safe_to_spend_locked)
    : computedSTS;

  const anchorDay = Number(profile.anchor_day_of_month || 1);
  const daysUntilSalary = daysUntilNextAnchor(anchorDay);

  const lines: string[] = [];
  lines.push('## GROUNDING CONTEXT (User Data — DEMO_TODAY = 2026-04-15)');
  lines.push('');

  lines.push('### Profile');
  if (profile.full_name) lines.push(`- Name: ${profile.full_name}`);
  if (profile.life_stage) lines.push(`- Life stage: ${profile.life_stage}`);
  if (profile.avatar) lines.push(`- Avatar: ${profile.avatar}`);
  lines.push(`- Net monthly income: ₹${INR(incomeNet)}`);
  lines.push(`- Anchor day (salary day of month): ${anchorDay}`);
  lines.push('');

  lines.push(`### Non-investing commitments (outflow — ${nonInvestingCommitments.length} items, total ₹${INR(totalNonInvesting)}/month)`);
  if (nonInvestingCommitments.length === 0) {
    lines.push('- (none)');
  } else {
    nonInvestingCommitments.forEach(c => {
      lines.push(`- ${c.label}: ₹${INR(Number(c.amount || 0))}/month${c.category ? ` [${c.category}]` : ''}`);
    });
  }
  lines.push('');

  lines.push(`### Investing commitments (savings — NOT outflow — ${investingCommitments.length} items, total ₹${INR(totalInvesting)}/month)`);
  if (investingCommitments.length === 0) {
    lines.push('- (none)');
  } else {
    investingCommitments.forEach(c => {
      lines.push(`- ${c.label}: ₹${INR(Number(c.amount || 0))}/month${c.category ? ` [${c.category}]` : ''}`);
    });
  }
  lines.push('');

  lines.push(`### Active goals (${activeGoals.length} items, total monthly contributions ₹${INR(totalGoalContrib)}/month)`);
  if (activeGoals.length === 0) {
    lines.push('- (none)');
  } else {
    activeGoals.forEach(g => {
      const target  = Number(g.target_amount || 0);
      const current = Number(g.current_amount || 0);
      const contrib = Number(g.monthly_contribution || 0);
      lines.push(`- ${g.label}: ₹${INR(current)} of ₹${INR(target)} (₹${INR(contrib)}/month toward target${g.target_date ? `, target date ${g.target_date}` : ''})`);
    });
  }
  lines.push('');

  lines.push('### Derived figures (use these — do not recompute)');
  lines.push(`- **Safe-to-spend this month: ₹${INR(safeToSpend)}**`);
  lines.push(`  (Formula: net income ₹${INR(incomeNet)} − non-investing commitments ₹${INR(totalNonInvesting)} − goal contributions ₹${INR(totalGoalContrib)} = ₹${INR(computedSTS)})`);
  lines.push(`- Days until next salary: ${daysUntilSalary}`);
  if (daysUntilSalary > 0) {
    lines.push(`- Daily safe-to-spend (informational): ₹${INR(Math.floor(safeToSpend / daysUntilSalary))}`);
  }
  lines.push('');

  if (merchantStats && merchantStats.length > 0) {
    lines.push('### Merchant reflection stats');
    merchantStats.forEach(s => {
      const rate = s.regret_rate != null ? `${s.regret_rate}%` : 'n/a';
      lines.push(`- ${s.merchant}: regret rate ${rate} (${s.regret_count ?? 0} regrets of ${s.total_transactions ?? 0} purchases)`);
    });
    lines.push('');
  }

  if (ritual) {
    lines.push('### Current monthly ritual');
    if (ritual.month_year) lines.push(`- Month: ${ritual.month_year}`);
    if (ritual.status) lines.push(`- Status: ${ritual.status}`);
    if (ritual.focus_goal_id) {
      const g = (goals || []).find(x => x.id === ritual.focus_goal_id);
      if (g) lines.push(`- Focus goal: ${g.label}`);
    }
  }

  return lines.join('\n');
};

export const buildSystemPrompt = (
  profile: any,
  goals: any[],
  commitments: any[],
  transactions: any[],
  ritual: any,
  merchantStats: any[]
): string => {
  const layer1 = buildIdentityLayer();
  const layer2 = buildVoiceLayer(profile.avatar || 'strategist');
  const layer3 = buildGroundingContext(profile, goals, commitments, transactions, ritual, merchantStats);

  return `${layer1}\n\n${layer2}\n\n${layer3}`;
};
