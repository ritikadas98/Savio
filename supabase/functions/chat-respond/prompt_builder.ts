// Edge function uses Deno
import { getUserRulesFromProfile, type UserRules } from '../_shared/user-rules.ts';
import { computeStsBreakdown } from '../_shared/safeToSpend.ts';
import { getSavingsState } from '../_shared/savings.ts';
import { extractPrice, classifyBuffer, type BufferAware } from '../_shared/bufferAware.ts';

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

// D.63 (Stream 0.5y) — deterministic "days remaining in current month" for
// the daily-SPS divisor. Calendar days from today through month-end,
// INCLUSIVE — so on the 1st of a 30-day month this returns 30. Convention
// matches what a user would intuitively count off on a calendar.
//
// Read via Intl with Asia/Kolkata so the day-of-month interpretation tracks
// the same IST anchor that computeDemoToday() uses. Last-day-of-month
// computed via Date.UTC(year, monthIndex + 1, 0) — the day-0-of-next-month
// trick is timezone-agnostic since we only consume the integer day value.
function daysRemainingInMonth(): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(DEMO_TODAY);
  const year = Number(parts.find(p => p.type === 'year')!.value);
  const monthIndex = Number(parts.find(p => p.type === 'month')!.value) - 1;
  const day = Number(parts.find(p => p.type === 'day')!.value);
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return lastDay - day + 1;
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
  - USE the pre-computed "Days remaining in current month" verbatim. Do NOT recompute the day count. Every response in a session must use the same day count — it's a calendar fact, not a per-question estimate.
  - USE the pre-computed "Daily safe-to-spend (today through month-end)" figure verbatim. Do NOT recompute it from safe-to-spend / day count.
  - When describing where the user's income goes, use the "Canonical income decomposition" block verbatim. Do NOT introduce alternative groupings (e.g., "₹38,500 fixed + ₹15,000 SIP + ₹9,000 goals", or "₹62,468 fixed commitments" with SIPs lumped into a single bucket) — those break the safe-to-spend math.
  - Do NOT recompute safe-to-spend from raw commitments — the derived figure is the authoritative value.
  - Investing commitments (SIPs, PPF, NPS, RDs) ARE subtracted from safe-to-spend — they auto-debit on payday, so they aren't spendable this month. PRESENT them as savings (not cost) — they're committed outflows toward the user's future, in the same shape as a goal contribution.
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
export const buildVerdictLayer = (rules: UserRules): string => {
  const safetyNetK = Math.round(rules.safety_net / 1000);                       // 100 → "₹1,00,000" / 100K → "₹100K"
  const safetyNetINR = rules.safety_net.toLocaleString('en-IN');
  const impulseTK = Math.round(rules.impulse_wait_threshold / 1000);            // 3 → "₹3K"
  const impulseTINR = rules.impulse_wait_threshold.toLocaleString('en-IN');
  const impulseH = rules.impulse_wait_hours;
  const dailyFloor = rules.daily_sps_floor.toLocaleString('en-IN');
  void safetyNetK;
  void impulseTK;

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
    "best_next_step": "string",      // 15-25 words, opens with the action phrase per C.26 (see ACTION LANGUAGE RULES below)
    "rule_citations": ["safety_net" | "impulse_wait" | "daily_sps_floor", ...]
                                     // D.52 (Stream 0.5t #8): every rule the user's stated rules
                                     // you actually reference anywhere in verdict_line / body /
                                     // tradeoffs / best_next_step gets its slug added here.
                                     // Empty array if no rule was relevant. Don't fabricate.
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

If the amount is too large (would exceed safe-to-spend or break the safety
net rule), STILL return structured with verdict_color = "RED" — do not fall
back to prose just because the spend is unwise. The structured RED card is
how you tell the user "no" with reasoning.

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
- GREEN: spend fits, no rules touched, safety net stays above its floor, daily budget stays workable
- YELLOW: spend works but has real tradeoffs — daily budget tight, focus-goal contribution at risk, eats most of the remaining month, OR the amount crosses the user's impulse-wait threshold
- RED: spend would break a rule — push safety net below ₹${safetyNetINR}, push daily safe-to-spend negative, or exceed total safe-to-spend

USER RULE VALUES (use these exact numbers when citing):
- Safety net: ₹${safetyNetINR}  (slug: "safety_net")
- Impulse-wait threshold: ₹${impulseTINR}  (slug: "impulse_wait")
- Impulse-wait duration: ${impulseH} hours  (same "impulse_wait" slug)
- Daily SPS floor: ₹${dailyFloor}  (slug: "daily_sps_floor")

VERDICT_LINE RULES (D.51 — Stream 0.5t #7):
- Open with the action phrase per ACTION LANGUAGE RULES below.
- When the spend amount is above ₹${impulseTINR}, name the impulse-wait threshold explicitly inside verdict_line. Example: "Think twice — this ₹4,000 watch is over your impulse-wait threshold of ₹${impulseTINR}."
- When the spend would push accessible cash below ₹${safetyNetINR}, name the safety net explicitly inside verdict_line. Example: "Step back — this would drop you below your safety net of ₹${safetyNetINR}."
- If no rule is crossed, verdict_line stays focused on the math (safe-to-spend impact). Don't fabricate rule violations.

BODY RULES (D.51 — extended):
- When verdict_line references a rule, body restates the rule briefly: "Your rule says wait ${impulseH} hours over ₹${impulseTINR}." OR: "Your rule keeps a ₹${safetyNetINR} safety net before discretionary spending."
- Body still carries the math (what the spend leaves, daily impact). Rule reference adds context; it doesn't replace the numbers.

TRADEOFFS RULES:
- 2 to 4 items, mix positive AND negative when possible
- Each item carries SPECIFIC NUMBERS, not vague phrasing
  GOOD: "Daily budget drops from ₹1,340 to ₹1,180 — still above your ₹${dailyFloor} floor"
  BAD:  "Daily budget reduced significantly"
- Reference the user's known rules where applicable ("above ₹${safetyNetINR} safety net rule", "still above ₹${dailyFloor} daily floor")

BEST_NEXT_STEP RULES:
- Open with the action phrase per ACTION LANGUAGE RULES below (matches verdict_color)
- After the opener, the rest of best_next_step references the user's impulse-wait rule (${impulseH} hours) for GREEN/YELLOW discretionary purchases, or a concrete next step for RED
- Action should be achievable in under 1 week

RULE_CITATIONS RULES (D.52 — Stream 0.5t #8):
- For every user rule you actually referenced (in verdict_line, body, tradeoffs[], or best_next_step), add its slug to rule_citations[]. Valid slugs: "safety_net", "impulse_wait", "daily_sps_floor".
- Empty array if no rule applied. Don't fabricate rule violations to populate the array.
- This array drives downstream verification + UI rendering. It's not decorative.

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
- GREEN verdict_line: "Go ahead — fits comfortably. ₹5K leaves ₹36K month safe-to-spend."
- YELLOW verdict_line: "Think twice — this ₹4,000 watch is over your impulse-wait threshold of ₹${impulseTINR}."
- RED verdict_line: "Step back — this would drop you below your safety net of ₹${safetyNetINR}."
- GREEN best_next_step: "Go ahead and complete the purchase — label it Worth-it / Regret after."
- YELLOW best_next_step: "Wait ${impulseH} hours per your impulse rule, then revisit."
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
  merchantStats: any[],
  carryForward: number = 0,
  userMessage: string = '',
): string => {
  const activeGoals = (goals || []).filter(g => g.status === 'active');

  // D.65 (Spec 2) — STS now derived from the shared module (mirror of
  // src/lib/safeToSpend.ts), so all three sites (Home, chat grounding,
  // close-out) compute identical results. Carry-forward is added in BOTH
  // branches per the spec: previously chat ignored it entirely while Home
  // added it — a linear-consistency drift that the parity test now blocks.
  const breakdown = computeStsBreakdown(profile.monthly_income_net, commitments || [], goals || [], carryForward);
  const { incomeNet, totalNonInvesting, totalInvesting, totalVariable, totalGoalContrib } = breakdown;
  const computedSTS = breakdown.safeToSpend;
  const safeToSpend = ritual?.safe_to_spend_locked != null
    ? Number(ritual.safe_to_spend_locked) + carryForward
    : computedSTS;

  // Keep the partitioned commitment lists for the presentation blocks below.
  const isFixed = (c: any) => (c.kind ?? 'fixed') !== 'variable';
  const fixedCommitments    = (commitments || []).filter(isFixed);
  const variableCommitments = (commitments || []).filter((c: any) => !isFixed(c));
  const nonInvestingCommitments = fixedCommitments.filter((c: any) => !isInvestingCategory(c.category));
  const investingCommitments    = fixedCommitments.filter((c: any) =>  isInvestingCategory(c.category));

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
  lines.push(`- Payday (day of month income lands): ${anchorDay}`);
  lines.push('');

  // D.57 (Stream 0.5u piece #1) — labeled "Fixed commitments" matching the
  // user-facing UI label (Home CommitmentsCard + Profile section). Subtitle
  // "(outflow, non-investing)" preserves the math-relevant subset distinction
  // for the AI without re-introducing finance-jargon to the user.
  lines.push(`### Fixed commitments (outflow, non-investing — ${nonInvestingCommitments.length} items, total ₹${INR(totalNonInvesting)}/month)`);
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

  // D.63 (Stream 0.5y) — days_remaining_in_month + daily_sps now injected as
  // deterministic facts the model must use verbatim. The first divergence-test
  // run surfaced day counts drifting between 29 / 30 / 31 across answers in
  // the same session (June has 30; 31 is impossible). Per D.40, cut the LLM
  // surface rather than guard it: precompute, inject, and mandate verbatim use
  // via the NUMBER DISCIPLINE block.
  const daysRemaining = daysRemainingInMonth();
  const dailySps = Math.round(safeToSpend / daysRemaining);

  lines.push('### Derived figures (use these verbatim — do not recompute)');
  lines.push(`- **Safe-to-spend this month: ₹${INR(safeToSpend)}**`);
  if (carryForward > 0) {
    lines.push(`  (Formula: net income ₹${INR(incomeNet)} − non-investing ₹${INR(totalNonInvesting)} − investing ₹${INR(totalInvesting)} − goals ₹${INR(totalGoalContrib)} + carry-forward ₹${INR(carryForward)} = ₹${INR(computedSTS)})`);
  } else {
    lines.push(`  (Formula: net income ₹${INR(incomeNet)} − non-investing commitments ₹${INR(totalNonInvesting)} − investing commitments ₹${INR(totalInvesting)} − goal contributions ₹${INR(totalGoalContrib)} = ₹${INR(computedSTS)})`);
  }
  lines.push(`- **Days remaining in current month (today through month-end, inclusive): ${daysRemaining}**`);
  lines.push(`- **Daily safe-to-spend (today through month-end): ₹${INR(dailySps)}** (= ₹${INR(safeToSpend)} ÷ ${daysRemaining})`);
  lines.push(`- Days until next payday: ${daysUntilSalary} (separate from days-remaining-in-month; use days-remaining for daily SPS, not this)`);
  lines.push('');

  // D.64 (Spec 1, revises D.63) — canonical income decomposition.
  // Four lines summing to net income: non-investing + investing + goals
  // + STS. Investing SIPs/RDs subtract from STS (auto-debit, not
  // spendable) but are PRESENTED as savings, not cost. The decomposition
  // is locked here and the NUMBER DISCIPLINE block mandates verbatim use,
  // so prose answers can't drift between groupings ("₹38,500 fixed +
  // ₹15,000 SIP", "₹62,468 fixed commitments lumped together", etc.).
  // Decomposition shape: when carry_forward > 0 the four buckets no longer
  // sum to income (income + carry = sum of buckets including STS). State
  // both the source breakdown and a "STS already includes carry-forward"
  // note so the model doesn't try to reconcile a missing rupee.
  const stsExcludingCarry = safeToSpend - carryForward;
  lines.push('### Canonical income decomposition (use this verbatim — do not rearrange)');
  lines.push(`Net monthly income ₹${INR(incomeNet)} decomposes as:`);
  lines.push(`- Non-investing commitments (cost — rent, EMIs, utilities, family support): ₹${INR(totalNonInvesting)}`);
  lines.push(`- Investing commitments (savings — SIPs / RDs / PPF / NPS, auto-debit toward future): ₹${INR(totalInvesting)}`);
  lines.push(`- Goal contributions (savings — earmarked toward specific goals): ₹${INR(totalGoalContrib)}`);
  lines.push(`- Safe-to-spend (discretionary — what's left for variable spending this month): ₹${INR(safeToSpend)}`);
  if (carryForward > 0) {
    lines.push(`- Of which carry-forward from last month's ritual: ₹${INR(carryForward)} (added to this month's STS — STS would have been ₹${INR(stsExcludingCarry)} without it)`);
    lines.push(`- Sum check: ₹${INR(totalNonInvesting)} + ₹${INR(totalInvesting)} + ₹${INR(totalGoalContrib)} + ₹${INR(stsExcludingCarry)} = ₹${INR(incomeNet)} ✓ (carry-forward ₹${INR(carryForward)} adds on top)`);
  } else {
    const checksum = totalNonInvesting + totalInvesting + totalGoalContrib + safeToSpend;
    lines.push(`- Sum check: ₹${INR(totalNonInvesting)} + ₹${INR(totalInvesting)} + ₹${INR(totalGoalContrib)} + ₹${INR(safeToSpend)} = ₹${INR(checksum)}`);
  }
  lines.push(`- Presentation: investing commitments and goal contributions are SAVINGS, not COST. Describe them that way. They still subtract from safe-to-spend because they are committed outflows the user can't redirect this month.`);
  lines.push('');

  // D.65 (Spec 2) — savings + cushion grounding. The numbers come from the
  // shared savings module (mirror of src/lib/savings.ts), the same source
  // the Profile "Your finances" UI reads. Spec 3's buffer-aware verdicts
  // consume `cushion` from this block.
  const savings = getSavingsState(profile, goals);
  lines.push('### Savings + safety net status (cushion is the ONLY spendable buffer above the safety-net rule)');
  lines.push(`- Safety net rule (slug: "safety_net"): ₹${INR(savings.safetyNet)}`);
  if (savings.backerLabel) {
    lines.push(`- ${savings.backerLabel} (backs the safety net — current balance covers the floor when ≥ ₹${INR(savings.safetyNet)}): ₹${INR(savings.backerBalance)}`);
  }
  lines.push(`- Unearmarked liquid (stated balance, not committed to any goal): ₹${INR(savings.unearmarkedLiquid)}`);
  if (savings.floorCovered) {
    lines.push(`- Floor coverage: COVERED (${savings.backerLabel ? `${savings.backerLabel} balance ₹${INR(savings.backerBalance)} ≥ ₹${INR(savings.safetyNet)}` : `unearmarked ₹${INR(savings.unearmarkedLiquid)} ≥ ₹${INR(savings.safetyNet)}`}).`);
    lines.push(`- **Spendable cushion above the safety net: ₹${INR(savings.cushion)}**`);
  } else {
    lines.push(`- Floor coverage: SHORT by ₹${INR(savings.rebuildGap)} (accessible liquid ₹${INR(savings.backerBalance + savings.unearmarkedLiquid)} < ₹${INR(savings.safetyNet)} safety net). No spendable cushion; the priority is rebuilding the floor.`);
    lines.push(`- Spendable cushion above the safety net: ₹0`);
  }
  lines.push(`- The cushion is NOT part of safe-to-spend. It is PARKED money above the floor. For general "how am I doing" responses, the cushion + floor status reads as a reserve note, not a spend allowance.`);
  lines.push('');

  // D.66 (Spec 3) — buffer-aware verdict guidance for THIS QUERY.
  // Server-side pre-classification of the user's price (if any) against
  // STS + cushion + safety net. The block injects deterministic figures
  // — buffer-after, months-to-rebuild — that the model must use verbatim
  // (D.40 / D.63 pattern: cut the LLM surface, don't guard it). The
  // block also FORBIDS the kind of free-narration the Spec 2 leak
  // surfaced ("dipping into your safety net" when the cushion sits
  // above the floor).
  //
  // Why classify in the prompt rather than in chat-respond/index.ts:
  // the prompt builder already has STS + cushion + safetyNet derived
  // from profile/goals/commitments. Doing the extraction here keeps the
  // chat-respond entrypoint thin and the parity test simple.
  const buffer: BufferAware = classifyBuffer(
    extractPrice(userMessage),
    computedSTS,           // base STS, no carry-forward (the rebuild rate the user has every month)
    savings.cushion,
    savings.safetyNet,
  );
  if (buffer.kind !== 'no_price') {
    lines.push('### Verdict guidance for this query (D.66 — buffer-aware)');
  }
  if (buffer.kind === 'within_sts') {
    lines.push(`- Price extracted from user message: ₹${INR(buffer.price)}.`);
    lines.push(`- Classification: WITHIN safe-to-spend. After this purchase, ₹${INR(buffer.stsRemaining)} would remain of this month's STS.`);
    lines.push(`- Standard verdict applies (GREEN if rules untouched, YELLOW if impulse-wait or other rule fires). DO NOT mention the cushion — it is parked, not a tradeoff for in-STS purchases.`);
    lines.push('');
  } else if (buffer.kind === 'within_cushion') {
    lines.push(`- Price extracted from user message: ₹${INR(buffer.price)}.`);
    lines.push(`- Classification: EXCEEDS safe-to-spend by ₹${INR(buffer.drawdown)}, but FITS within the cushion (₹${INR(buffer.bufferBefore)}). This is the buffer-aware YELLOW case.`);
    lines.push(`- **Use verdict_color = "YELLOW"**. Do NOT use GREEN; the cushion is a tradeoff with a rebuild cost, not permission.`);
    lines.push(`- **verdict_line** opens with "Think twice — " (action language) and names the cushion drawdown succinctly. Example shape: "Think twice — this ₹${INR(buffer.price)} laptop draws ₹${INR(buffer.drawdown)} from your cushion."`);
    lines.push(`- **body** is short (30-50 words): state that the purchase exceeds STS by ₹${INR(buffer.drawdown)} and draws from the cushion. DO NOT fabricate buffer-after numbers in the body — leave the precise numbers to tradeoffs[].`);
    lines.push(`- **tradeoffs[]** carries the lever — MUST include these TWO items with the figures verbatim (do NOT recompute):`);
    lines.push(`  1. "Drops your cushion from ₹${INR(buffer.bufferBefore)} to ₹${INR(buffer.bufferAfter)} (drawdown of ₹${INR(buffer.drawdown)})."`);
    lines.push(`  2. "Rebuilding takes ~${buffer.monthsToRebuild} month${buffer.monthsToRebuild === 1 ? '' : 's'} at your ₹${INR(computedSTS)}/month STS rate."`);
    lines.push(`  These two phrases are the LEVER. Paraphrase only minimally; the figures (₹${INR(buffer.bufferBefore)}, ₹${INR(buffer.bufferAfter)}, ₹${INR(buffer.drawdown)}, ~${buffer.monthsToRebuild} month${buffer.monthsToRebuild === 1 ? '' : 's'}, ₹${INR(computedSTS)}/month) MUST appear exactly as given.`);
    lines.push(`- The cushion sits ABOVE the safety net (₹${INR(savings.safetyNet)}) which the ${savings.backerLabel ?? 'emergency fund'} backs. This purchase does NOT touch the safety net — do NOT say "dipping into safety net" or similar.`);
    lines.push('');
  } else if (buffer.kind === 'breaches_floor') {
    lines.push(`- Price extracted from user message: ₹${INR(buffer.price)}.`);
    lines.push(`- Classification: EXCEEDS spendable-above-floor (STS ₹${INR(computedSTS)} + cushion ₹${INR(savings.cushion)} = ₹${INR(buffer.spendableAboveFloor)}) by ₹${INR(buffer.overBy)}. Floor-breach case.`);
    lines.push(`- **Use verdict_color = "RED"**. Name the safety net (₹${INR(buffer.safetyNet)}) — this purchase would exhaust the cushion AND require dipping into the floor that the ${savings.backerLabel ?? 'emergency fund'} backs.`);
    lines.push(`- DO NOT say the purchase "dips into safety net" loosely — be specific: it exhausts STS + cushion (₹${INR(buffer.spendableAboveFloor)} together) and pushes against the ₹${INR(buffer.safetyNet)} floor.`);
    lines.push(`- rule_citations[] must include "safety_net".`);
    lines.push('');
  } else if (buffer.kind === 'cushion_unavailable') {
    lines.push(`- Price extracted from user message: ₹${INR(buffer.price)}.`);
    lines.push(`- Classification: EXCEEDS safe-to-spend by ₹${INR(buffer.stsExceedBy)}; no spendable cushion exists (cushion = ₹0). Buffer-aware logic is DORMANT — verdict logic falls back to Spec 1 (RED with no "but you have savings" softening).`);
    lines.push(`- **Use verdict_color = "RED"**. Do not invoke buffer language; the user has no cushion to draw on.`);
    lines.push('');
  }

  // D.66 — forbidden phrasing for the cushion/floor relationship,
  // regardless of which classification fires. The Spec 2 leak said
  // "dipping into your safety net" when the cushion is ABOVE the floor;
  // make that wrong specifically.
  lines.push('### Cushion/floor language rules (D.66 — applies to ALL responses)');
  lines.push(`- The cushion (₹${INR(savings.cushion)}) sits ABOVE the safety net (₹${INR(savings.safetyNet)}). The ${savings.backerLabel ?? 'emergency fund'} BACKS the safety net.`);
  lines.push(`- FORBIDDEN: "dipping into your safety net" / "would dip into the floor" when the cushion is the path being drawn down. The correct phrasing is "drops your cushion from ₹X to ₹Y" — the safety net is only touched when the purchase exceeds STS + cushion together.`);
  lines.push(`- FORBIDDEN: framing the cushion as a green light ("you have savings, so it's fine"). The cushion is a tradeoff with a rebuild cost — never permission.`);
  lines.push('');

  // D.49 + D.51 (Stream 0.5t pieces #5 + #7) — user rules now read from
  // the profile row via getUserRulesFromProfile(). Was hardcoded English-
  // language constants pre-0.5t which caused two bugs:
  //   1. Impulse-wait threshold drifted between prompt (₹2,000) and
  //      Profile UI (₹3,000). Fixed by construction here — same source.
  //   2. "Buffer floor" was finance-jargon; renamed to "Safety net" per
  //      D.48.
  // Citation instructions for verdict_line + body live in the verdict
  // layer (D.51 extended); this section just provides the data + slugs.
  const rules = getUserRulesFromProfile(profile);
  lines.push('### User rules (reference these in verdict_line / body / tradeoffs / best_next_step — and add the slug to rule_citations[] per D.52)');
  lines.push(`- Safety net (slug: "safety_net"): maintain emergency fund / accessible cash above ₹${rules.safety_net.toLocaleString('en-IN')}`);
  lines.push(`- Impulse purchase wait (slug: "impulse_wait"): ${rules.impulse_wait_hours} hours before any discretionary spend above ₹${rules.impulse_wait_threshold.toLocaleString('en-IN')}`);
  lines.push(`- Daily safe-to-spend floor (slug: "daily_sps_floor"): prefer to keep daily SPS above ₹${rules.daily_sps_floor.toLocaleString('en-IN')} for the remainder of the month`);
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
  merchantStats: any[],
  carryForward: number = 0,
  userMessage: string = '',
): string => {
  const rules = getUserRulesFromProfile(profile);
  const layer1 = buildIdentityLayer();
  const layer2 = buildVoiceLayer(profile.avatar || 'strategist');
  const layer3 = buildGroundingContext(profile, goals, commitments, transactions, ritual, merchantStats, carryForward, userMessage);
  const layer4 = buildVerdictLayer(rules);
  const layer5 = buildProseStructureLayer();

  return `${layer1}\n\n${layer2}\n\n${layer3}\n\n${layer4}\n\n${layer5}`;
};
