// D.66 (Stream 0.5z Spec 3) — buffer-aware verdict classification.
//
// PURPOSE
// Pre-classify an affordability query into one of three buckets and inject
// the lever values verbatim, so the LLM never improvises the
// cushion/floor relationship. Mirrors the D.40/D.63 pattern: cut the
// surface, don't guard it.
//
// CONSUMED BY
// supabase/functions/chat-respond/index.ts (calls extractPrice on the
// user message, then classifyBuffer on STS / cushion / safetyNet). The
// result goes into buildSystemPrompt → buildGroundingContext, which
// emits a per-query "verdict guidance for this query" block.
//
// IMPORTABLE FROM VITEST
// This module uses no Deno-specific globals so tests/unit/ can import
// directly. The Deno runtime imports it via the standard relative path.

// ─────────────────────────────────────────────────────────────────────
// Price extraction
// ─────────────────────────────────────────────────────────────────────
// Reads amounts the way people type them:
//   ₹35,000 / Rs 8000 / INR 8000   → as stated (Indian comma grouping ok)
//   ₹8k / 8k / ₹2.5K               → × 1,000
//   ₹1L / 1.5L / 1 lakh / 2 lac    → × 100,000
//   8000 rupees / 8000 rupee watch → as stated
// A bare number with no currency or unit ("48 hours", "3 months") is not a price.
// The eval found "8k ka watch le lu?" and "an 8000 rupee watch" getting no
// code-decided verdict because only ₹-prefixed amounts were read.
const NUM = String.raw`(\d[\d,]*(?:\.\d+)?)`;
const UNIT = String.raw`(k|l|lakhs?|lacs?)`;
const PRICE_RE = new RegExp(
  String.raw`(?:₹|\brs\.?|\binr\b)\s?${NUM}\s*${UNIT}?\b` +   // ₹8k, Rs 8000
  String.raw`|\b${NUM}\s*${UNIT}\b` +                        // 8k, 1 lakh
  String.raw`|\b${NUM}\s*(?:rupees?|rs\.?|inr)(?![a-z])`,     // 8000 rupees
  'gi',
);

function amounts(msg: string): Array<{ n: number; at: number }> {
  const out: Array<{ n: number; at: number }> = [];
  for (const m of (msg ?? '').matchAll(PRICE_RE)) {
    const raw = m[1] ?? m[3] ?? m[5];
    const unit = (m[2] ?? m[4] ?? '').toLowerCase();
    const n = Number(raw.replace(/,/g, '')) * (unit === 'k' ? 1000 : unit ? 100000 : 1);
    if (Number.isFinite(n) && n > 0) out.push({ n: Math.round(n), at: m.index ?? 0 });
  }
  return out;
}

export function extractPrices(msg: string): number[] {
  return amounts(msg).map(a => a.n);
}

// First amount in the message.
export function extractPrice(msg: string): number | null {
  return extractPrices(msg)[0] ?? null;
}

// The spend the user is asking about, or null when code cannot tell.
//  - Amounts right after "earn" / "salary" / "income" are not prices
//    ("I earn ₹2,00,000 now. Can I afford a ₹50,000 laptop?" → ₹50,000).
//  - "On top of this ₹8k watch I also want a ₹1L Apple Watch" names both,
//    so they are summed.
//  - "And ₹6,000 for the hotel on top of that?" adds to something said in an
//    earlier turn. This message alone cannot give the total, so return null;
//    extractSpendInChat below adds the earlier total.
const CUMULATIVE_RE = /\b(on top of|also|plus|as well|in addition|along with|together|combined|both|add)\b/i;
const INCOME_BEFORE_RE = /\b(earn|earning|salary|income|take[- ]home|paid|make)\b[^.?!]{0,15}$/i;
function spendAmounts(msg: string): number[] {
  return amounts(msg)
    .filter(a => !INCOME_BEFORE_RE.test(msg.slice(Math.max(0, a.at - 30), a.at)))
    .map(a => a.n);
}

export function extractSpend(msg: string): number | null {
  const spend = spendAmounts(msg);
  if (CUMULATIVE_RE.test(msg)) return spend.length > 1 ? spend.reduce((a, b) => a + b, 0) : null;
  return spend[0] ?? null;
}

// The spend across the chat. `earlier` is the user's previous messages,
// newest first. "Add a ₹10,000 pair of earbuds to that" after "Can I afford
// a ₹20,000 phone?" is ₹30,000. "What about an ₹8k watch instead?" has no
// add-on word, so it stands alone. A message with no price ("Just the
// phone?") returns null and the model decides from the chat history.
export function extractSpendInChat(msg: string, earlier: string[]): number | null {
  const own = extractSpend(msg);
  if (own !== null) return own;
  const spend = spendAmounts(msg);
  if (spend.length === 1 && CUMULATIVE_RE.test(msg) && earlier.length > 0) {
    const before = extractSpendInChat(earlier[0], earlier.slice(1));
    return before === null ? null : before + spend[0];
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Buffer-aware classification
// ─────────────────────────────────────────────────────────────────────
export type BufferAware =
  | { kind: 'no_price' }
  | { kind: 'within_sts'; price: number; stsRemaining: number }
  | {
      kind: 'within_cushion';
      price: number;
      drawdown: number;          // price − STS (the part dipping into the cushion)
      bufferBefore: number;      // cushion before
      bufferAfter: number;       // cushion − drawdown
      monthsToRebuild: number;   // ceil(drawdown / monthlyStsBase)
    }
  | {
      kind: 'breaches_floor';
      price: number;
      spendableAboveFloor: number;  // STS + cushion
      overBy: number;               // price − (STS + cushion)
      safetyNet: number;
    }
  | { kind: 'cushion_unavailable'; price: number; stsExceedBy: number }; // STS short, cushion = 0

export function classifyBuffer(
  price: number | null,
  monthlyStsBase: number,
  cushion: number,
  safetyNet: number,
): BufferAware {
  if (price === null) return { kind: 'no_price' };

  if (price <= monthlyStsBase) {
    return { kind: 'within_sts', price, stsRemaining: monthlyStsBase - price };
  }

  const stsExceedBy = price - monthlyStsBase;

  // Cushion=0 path: feature dormant per Spec 3 #5. Verdict logic falls
  // back to Spec 1 — RED with no "but you have savings" softening.
  if (cushion <= 0) {
    return { kind: 'cushion_unavailable', price, stsExceedBy };
  }

  const spendableAboveFloor = monthlyStsBase + cushion;
  if (price > spendableAboveFloor) {
    return {
      kind: 'breaches_floor',
      price,
      spendableAboveFloor,
      overBy: price - spendableAboveFloor,
      safetyNet,
    };
  }

  // STS < price ≤ STS + cushion → YELLOW with rebuild copy.
  // Rebuild rate = monthly STS base. Optimistic upper bound — assumes
  // the user saves their entire STS in subsequent months. The "from
  // ₹{stsBase}/month" phrasing in the verdict makes the assumption
  // transparent to the user.
  const drawdown = stsExceedBy;
  const bufferAfter = cushion - drawdown;
  const monthsToRebuild = Math.max(1, Math.ceil(drawdown / Math.max(1, monthlyStsBase)));

  return {
    kind: 'within_cushion',
    price,
    drawdown,
    bufferBefore: cushion,
    bufferAfter,
    monthsToRebuild,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Verdict colour — decided in code, never by the model
// ─────────────────────────────────────────────────────────────────────
// Before this, a price inside safe-to-spend got "GREEN if no rule fires,
// YELLOW if the impulse-wait rule fires" as an instruction, and the model
// chose. It chose differently for a ₹5,000 and an ₹8,000 watch under the
// same 48-hour rule. Same discipline as the figures: code decides, the
// model writes the sentence.
export type VerdictColor = 'GREEN' | 'YELLOW' | 'RED';
export type Verdict = { color: VerdictColor; reason: string };

export function decideVerdict(
  b: BufferAware,
  rules: { impulse_wait_threshold: number; daily_sps_floor: number },
  daysRemaining: number,
): Verdict | null {
  switch (b.kind) {
    case 'no_price':
      return null;
    case 'within_sts':
      if (b.price > rules.impulse_wait_threshold) {
        return { color: 'YELLOW', reason: 'over the impulse-wait threshold' };
      }
      if (b.stsRemaining / Math.max(1, daysRemaining) < rules.daily_sps_floor) {
        return { color: 'YELLOW', reason: 'the daily budget would fall below the daily floor' };
      }
      return { color: 'GREEN', reason: 'fits safe-to-spend and crosses no rule' };
    case 'within_cushion':
      return { color: 'YELLOW', reason: 'over safe-to-spend; the cushion covers the difference' };
    case 'breaches_floor':
      return { color: 'RED', reason: 'over safe-to-spend plus cushion; it would cut into the safety net' };
    case 'cushion_unavailable':
      return { color: 'RED', reason: 'over safe-to-spend and there is no cushion' };
  }
}
