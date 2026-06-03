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
// Three forms, in priority order:
//   ₹1L / ₹1.5L     → × 100,000        (Indian lakh)
//   ₹50k / ₹8K      → × 1,000          (shorthand)
//   ₹35,000 / ₹1,00,000  → as-stated  (plain rupees with optional Indian comma grouping)
//
// Returns the FIRST price match in the message. For multi-purchase
// messages ("₹8k watch and ₹1L Apple Watch"), the model is responsible
// for summing via chat history (already works) — this helper only
// surfaces the simple "Can I afford ₹X" path that benefits from a
// deterministic lever.
export function extractPrice(msg: string): number | null {
  if (!msg) return null;
  // One regex, two alternatives. Whichever matches first by POSITION
  // wins (so the first ₹ in the message is the one returned).
  // Alternative 1: shorthand with K/L unit (₹8k, ₹1.5L).
  // Alternative 2: plain numeric with Indian comma grouping (₹35,000, ₹1,00,000).
  // Anchored on ₹ so bare numbers in unrelated text don't match.
  // Shorthand listed first within the alternation so "₹8k" doesn't
  // resolve to plain "₹8" via the numeric branch — the regex engine
  // tries alternatives left-to-right at each starting position.
  const re = /₹\s?(\d+(?:\.\d+)?)\s*([KkLl])\b|₹\s?(\d[\d,]*\d|\d)\b/;
  const m = msg.match(re);
  if (!m) return null;

  if (m[1] && m[2]) {
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) return null;
    const unit = m[2].toLowerCase();
    if (unit === 'k') return Math.round(n * 1000);
    if (unit === 'l') return Math.round(n * 100000);
  }
  if (m[3]) {
    const n = Number(m[3].replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0) return n;
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
