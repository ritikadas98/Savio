// Hallucination guard.
//
// Allows a number in the AI's response if it is either:
//   1. Directly present in the grounding context or the user's message (within ±2%), OR
//   2. Derivable from arithmetic on two grounded inputs:
//        - sum (a + b)
//        - difference (a − b or b − a)
//        - percentage (a / b × 100)
//
// Without this, valid derived math like "₹12,032 − ₹5,000 = ₹7,032" is flagged
// as hallucination because ₹7,032 isn't a literal grounded number.

const TOLERANCE = 0.02;        // ±2% — matches the original guard tolerance
const MIN_NOISE = 100;         // ignore tiny numbers (line counts, list indices etc.)

function extractNumbers(text: string): number[] {
  const out: number[] = [];
  const re = /(?:₹\s*)?([\d,]+(?:\.\d+)?)\s*%?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1];
    if (!/\d/.test(raw)) continue;
    const n = parseFloat(raw.replace(/,/g, ''));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

function within(a: number, b: number): boolean {
  if (b === 0) return Math.abs(a) <= 0.01;
  return Math.abs(a - b) / Math.abs(b) <= TOLERANCE;
}

function isGrounded(num: number, inputs: number[]): boolean {
  return inputs.some(g => within(num, g));
}

function isDerivable(num: number, inputs: number[]): boolean {
  if (isGrounded(num, inputs)) return true;
  for (let i = 0; i < inputs.length; i++) {
    for (let j = 0; j < inputs.length; j++) {
      if (i === j) continue;
      const a = inputs[i], b = inputs[j];
      if (within(num, a + b)) return true;
      if (within(num, a - b)) return true;
      if (b !== 0 && within(num, (a / b) * 100)) return true;
    }
  }
  return false;
}

export function hallucinationGuard(response: string, context: string, userMessage = '') {
  const responseNumbers = extractNumbers(response).filter(n => n >= MIN_NOISE || n >= 1); // keep small percentages
  if (responseNumbers.length === 0) {
    return { verified: true, finalResponse: response, fallback_used: false, corrections: null };
  }

  const groundedInputs = [
    ...extractNumbers(context),
    ...extractNumbers(userMessage),
  ];

  const unverified: number[] = [];
  for (const n of responseNumbers) {
    if (!isDerivable(n, groundedInputs)) unverified.push(n);
  }

  if (unverified.length === 0) {
    return { verified: true, finalResponse: response, fallback_used: false, corrections: null };
  }

  // Strict policy: any unverified number triggers the fallback. The earlier
  // "1 failure -> still ship the response" branch could leak hallucinated
  // figures to the user; with arithmetic derivation enabled, surviving
  // unverified numbers are far more likely to be genuine fabrications.
  return {
    verified: false,
    fallback_used: true,
    corrections: unverified.map(n => `unverified: ${n}`),
    finalResponse: "Let me check that more carefully — I noticed some inconsistencies in the numbers. Please verify against your dashboard.",
  };
}

// Phase 3 Build D.18 — Stream 0.5o piece 2.
//
// Before D.18: chat-respond invoked hallucinationGuard() with just
// `verdict_line`. body / tradeoffs / best_next_step were emitted to the
// user without their numbers ever being checked against the grounding
// context. The C3 verdict surface was load-bearing, but the guard wasn't
// covering most of what it shipped.
//
// After D.18: this wrapper runs the same single-string guard against
// every text-bearing field in the structured verdict, in turn. If any
// field has an unverified rupee/percentage, the whole response falls
// back to the prose-error message — same discipline as the single-field
// path, just with broader coverage. Corrections tag the field name so
// the ai_metadata.corrections trail is debuggable.

export interface StructuredFieldsForGuard {
  verdict_line: string;
  body: string;
  tradeoffs: string[];
  best_next_step: string;
}

export interface StructuredGuardResult {
  verified: boolean;
  fallback_used: boolean;
  // Field-tagged so the ai_metadata audit trail tells you WHERE the
  // unverified number lived, not just that one existed.
  corrections: Array<{ field: string; unverified: number }> | null;
  // Drop-in compatibility with the single-string guard's caller. When
  // any field fails, we surface the same fallback prose the original
  // guard uses, so the caller can swap `finalResponse` in unconditionally.
  finalResponse: string;
}

export function hallucinationGuardStructured(
  structured: StructuredFieldsForGuard,
  context: string,
  userMessage = '',
): StructuredGuardResult {
  const allCorrections: Array<{ field: string; unverified: number }> = [];

  const checkField = (fieldName: string, text: string) => {
    const r = hallucinationGuard(text, context, userMessage);
    if (!r.verified && r.corrections) {
      for (const c of r.corrections) {
        // single-string guard formats corrections as `unverified: <n>`
        const m = c.match(/unverified:\s*([\d.]+)/);
        const n = m ? parseFloat(m[1]) : NaN;
        if (Number.isFinite(n)) allCorrections.push({ field: fieldName, unverified: n });
      }
    }
  };

  checkField('verdict_line', structured.verdict_line);
  checkField('body', structured.body);
  checkField('best_next_step', structured.best_next_step);
  for (let i = 0; i < structured.tradeoffs.length; i++) {
    checkField(`tradeoffs[${i}]`, structured.tradeoffs[i]);
  }

  if (allCorrections.length === 0) {
    return {
      verified: true,
      fallback_used: false,
      corrections: null,
      finalResponse: structured.verdict_line,
    };
  }

  return {
    verified: false,
    fallback_used: true,
    corrections: allCorrections,
    finalResponse: "Let me check that more carefully — I noticed some inconsistencies in the numbers. Please verify against your dashboard.",
  };
}
