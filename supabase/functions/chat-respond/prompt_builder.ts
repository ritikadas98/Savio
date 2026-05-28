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
- The "message" field in your JSON output supports Markdown. Bold the labels in the Observation / Stake / Partnership Offer pattern with **double asterisks**.
- Keep answers concise (3–6 short paragraphs maximum).
`;
};

// Phase C3 — Structured-verdict layer. Forces the model to return JSON of
// shape {kind, message?, structured?} on every call. Verdict-eligible
// queries get structured; everything else stays prose. The frontend routes
// off `kind`. Returned strictly as JSON via responseMimeType in the payload.
export const buildVerdictLayer = (): string => {
  return `OUTPUT CONTRACT (STRICT):
Always return a single JSON object. No prose preamble. No markdown fences.

Shape:
{
  "kind": "prose" | "structured",
  "message": "string",       // Required for prose. For structured, can be a short echo of verdict_line (used as fallback if frontend can't render the card).
  "structured": {            // ONLY when kind === "structured". Omit otherwise.
    "verdict_color": "GREEN" | "YELLOW" | "RED",
    "verdict_line": "string",        // 15-25 words, opens with the action phrase per C.26 (see ACTION LANGUAGE RULES below)
    "body": "string",                // 30-50 words. The math — what the spend leaves, daily impact, rules touched.
    "tradeoffs": ["string", ...],    // 2-4 items, MIX positive and negative, each with specific numbers
    "best_next_step": "string"       // 15-25 words, opens with the action phrase per C.26 (see ACTION LANGUAGE RULES below)
  }
}

WHEN TO USE structured:
The user is asking for a yes/no decision on a SPECIFIC SPEND AMOUNT.
Triggers (any of) — fire REGARDLESS of how large or small the amount is:
- "Can I afford a ₹X [thing]?"
- "Should I buy [thing for ₹X]?"
- "Is ₹X on [thing] OK?"
- "I'm thinking of getting [thing for ₹X]"
- "Should I get a ₹X [thing]?"

If the amount is too large (would exceed safe-to-spend or break the buffer
rule), STILL return structured with verdict_color = "RED" — do not fall back
to prose just because the spend is unwise. The structured RED card is how
you tell the user "no" with reasoning.

WHEN TO USE prose (kind="prose"):
Everything else. Examples:
- Tracking questions: "Am I on track this month?"
- Summary: "Show me where I'm spending"
- Pattern questions: "What's my regret rate?"
- Goal status: "Tell me about my goals"
- Scope-deflected: "Should I invest in ELSS?" (handoff, not verdict)
- Education/meta: "How does Savio work?"
- Open-ended worry: "I'm worried about money"

VERDICT_COLOR LOGIC:
- GREEN: spend fits, no rules touched, buffer stays above floor, daily budget stays workable
- YELLOW: spend works but has real tradeoffs — daily budget tight, focus-goal contribution at risk, eats most of the remaining month
- RED: spend would break a rule — push buffer below ₹1,00,000 floor, push daily safe-to-spend negative, or exceed total safe-to-spend

TRADEOFFS RULES:
- 2 to 4 items, mix positive AND negative when possible
- Each item carries SPECIFIC NUMBERS, not vague phrasing
  GOOD: "Daily budget drops from ₹715 to ₹435 — still above your ₹300 floor"
  BAD:  "Daily budget reduced significantly"
- Reference the user's known rules where applicable ("above ₹1L buffer rule", "still above ₹300 daily floor")

BEST_NEXT_STEP RULES:
- Open with the action phrase per ACTION LANGUAGE RULES below (matches verdict_color)
- After the opener, the rest of best_next_step references the user's impulse-wait rule (48 hours) for GREEN/YELLOW discretionary purchases, or a concrete next step for RED
- Action should be achievable in under 1 week

ACTION LANGUAGE RULES (C.26 — verdict_line + best_next_step ONLY):

verdict_color signals the verdict visually via card chrome. NEVER name the
color word inside any of the four structured response fields. ALWAYS open
verdict_line and best_next_step with action language matching the verdict:

- verdict_color: GREEN
  → verdict_line opens with: "Go ahead — "
  → best_next_step opens with: "Go ahead and ..."  (or a Go-ahead variant)

- verdict_color: YELLOW
  → verdict_line opens with: "Think twice — "
  → best_next_step opens with: "Wait ..."  OR  "Hold off ..."

- verdict_color: RED
  → verdict_line opens with: "Step back — "
  → best_next_step opens with: "Defer ..."  OR  "Skip this ..."

FORBIDDEN PHRASES (in any of verdict_line, body, tradeoffs[], best_next_step):
- "GREEN" / "YELLOW" / "RED" (the color names themselves)
- "green light" / "yellow light" / "red light"
- "greenlight" / "yellowlight" / "redlight"

body and tradeoffs[] stay neutral — no forced action language there. These
rules apply to verdict-shaped responses only. Prose responses are unaffected.

SAMPLE OPENERS (for the model's reference, not for literal copying):
- GREEN verdict_line: "Go ahead — fits comfortably. ₹5K leaves ₹7K daily buffer."
- YELLOW verdict_line: "Think twice — workable but tight. Pulls daily spend to ₹400."
- RED verdict_line: "Step back — too heavy right now. ₹50K equals 4 months of safe-to-spend."
- GREEN best_next_step: "Go ahead and complete the purchase — label it Worth-it / Regret after."
- YELLOW best_next_step: "Wait 48 hours per your impulse rule, then revisit."
- RED best_next_step: "Defer to next month's ritual — see if it makes the focus-goal list."
`;
};

// Stream 0.5m — prose-structure constraint shared across all voices. Three
// human-framed labels replace the prior "Observation / Stake / Partnership
// Offer" pattern, which read as research-paper-meets-SaaS-pitch. The labels
// themselves are constant; only voice/tone varies per avatar.
//
// Explicit forbidding of old labels matters — without it the model often
// reverts to "Observation / Stake" mid-conversation as a template fallback.
export const buildProseStructureLayer = (): string => {
  return `PROSE STRUCTURE (use ONLY when kind="prose" in the JSON output):

Structure every prose response with EXACTLY these three labels, in this order, each on its own line, each in markdown bold:

**Where you stand:** [Factual answer to their question — current state, specific numbers, what's true right now. 1-2 sentences.]

**What it means:** [Interpretive context — why this matters in their situation, what it tells them about their financial position. 2-3 sentences.]

**What you can do:** [Action-oriented framing — concrete options, suggested next step, or invitation to keep exploring. 1-2 sentences.]

PROSE CONSTRAINTS:
- Use ONLY the three labels above. NEVER use "Observation", "Stake", "Partnership Offer", "Summary", "Key Insights", "Recommendation", "Analysis", "Conclusion", or any other section labels.
- Each label appears exactly once, in order.
- Each section is 1-3 sentences. Total response under 150 words.
- Conversational tone — like a friend who happens to understand finance, not a financial advisor writing a report.
- Cite specific numbers from the user's data when relevant; never invent figures.
`;
};

export const buildVoiceLayer = (avatar: string): string => {
  switch (avatar.toLowerCase()) {
    case 'strategist':
      return `VOICE RULE (The Strategist):
Your tone is math-forward, precision-oriented, and rule-referenced. The user wants to verify their work and see the math. Be analytical but supportive. Use numbers clearly.`;
    case 'adventurer':
      return `VOICE RULE (The Adventurer):
Your tone is practical, flow-oriented, and cautious only when necessary. The user wants to know if there's a problem, otherwise let them live.`;
    case 'builder':
      return `VOICE RULE (The Builder):
Your tone is progress-focused and goal-oriented. The user is working towards something. Show them progress.`;
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

  // Phase 3: commitments now have a `kind` field. Fixed = mini-accounts where
  // actual == budgeted (subtract from safe-to-spend formula). Variable = soft
  // budgets within the discretionary bucket (NOT subtracted from safe-to-spend;
  // their buffer/overrun is surfaced separately).
  const isFixed = (c: any) => (c.kind ?? 'fixed') !== 'variable';

  const fixedCommitments    = (commitments || []).filter(isFixed);
  const variableCommitments = (commitments || []).filter((c: any) => !isFixed(c));

  const nonInvestingCommitments = fixedCommitments.filter((c: any) => !isInvestingCategory(c.category));
  const investingCommitments    = fixedCommitments.filter((c: any) =>  isInvestingCategory(c.category));

  const totalNonInvesting = nonInvestingCommitments.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalInvesting    = investingCommitments.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalVariable     = variableCommitments.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalGoalContrib  = activeGoals.reduce((s, g) => s + Number(g.monthly_contribution || 0), 0);

  // Authoritative safe-to-spend: lock-in from ritual if present, else computed.
  const computedSTS = incomeNet - totalNonInvesting - totalGoalContrib;
  const safeToSpend = ritual?.safe_to_spend_locked != null
    ? Number(ritual.safe_to_spend_locked)
    : computedSTS;

  const anchorDay = Number(profile.anchor_day_of_month || 1);
  const daysUntilSalary = daysUntilNextAnchor(anchorDay);

  const demoTodayLabel = DEMO_TODAY.toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`## GROUNDING CONTEXT (User Data — DEMO_TODAY = ${demoTodayLabel})`);
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

  lines.push(`### Variable commitments (informational budgets — within discretionary, NOT subtracted from safe-to-spend — ${variableCommitments.length} items, total ₹${INR(totalVariable)}/month budgeted)`);
  if (variableCommitments.length === 0) {
    lines.push('- (none)');
  } else {
    variableCommitments.forEach((c: any) => {
      lines.push(`- ${c.label}: ₹${INR(Number(c.amount || 0))}/month budget${c.category ? ` [${c.category}]` : ''}`);
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

  // Phase C3 — user rules referenced by structured-verdict tradeoffs and
  // best-next-step. These aren't on the profile row yet (V2 work to expose
  // as editable settings); hardcoded constants here keep the AI grounded.
  lines.push('### User rules (reference these in tradeoffs and best_next_step)');
  lines.push('- Buffer floor: maintain emergency fund / accessible cash above ₹1,00,000');
  lines.push('- Impulse purchase wait: 48 hours before any discretionary spend above ₹2,000');
  lines.push('- Daily safe-to-spend floor: prefer to keep daily SPS above ₹300 for the remainder of the month');
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
  const layer4 = buildVerdictLayer();
  const layer5 = buildProseStructureLayer();

  return `${layer1}\n\n${layer2}\n\n${layer3}\n\n${layer4}\n\n${layer5}`;
};
