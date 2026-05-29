// Phase C3 — structured verdict shape. Mirrored on the Edge Function side at
// supabase/functions/chat-respond/index.ts. Frontend treats AI responses as
// either prose (existing path) or structured (renders as VerdictCard).
//
// VerdictColor maps to saved_decisions.verdict enum on persist:
//   GREEN  → 'green'
//   YELLOW → 'amber'
//   RED    → 'red'

export type VerdictColor = 'GREEN' | 'YELLOW' | 'RED';

// D.52 (Stream 0.5t piece #8) — slugs the AI declares it cited.
// Mirror in supabase/functions/chat-respond/prompt_builder.ts verdict layer.
export type RuleCitationSlug = 'safety_net' | 'impulse_wait' | 'daily_sps_floor';

export interface StructuredVerdict {
  verdict_color: VerdictColor;
  verdict_line: string;
  body: string;
  tradeoffs: string[];
  best_next_step: string;
  // D.52 — optional for backward compat with older cached/saved verdicts that
  // pre-date Stream 0.5t. Always populated (possibly as empty array) on new
  // responses. Pre-0.5t saved_decisions rows render with no badges; no breakage.
  rule_citations?: RuleCitationSlug[];
}

export function isValidStructured(s: unknown): s is StructuredVerdict {
  if (!s || typeof s !== 'object') return false;
  const v = s as Record<string, unknown>;
  const baseOk = (
    (v.verdict_color === 'GREEN' || v.verdict_color === 'YELLOW' || v.verdict_color === 'RED')
    && typeof v.verdict_line === 'string' && v.verdict_line.length > 0
    && typeof v.body === 'string' && v.body.length > 0
    && Array.isArray(v.tradeoffs) && v.tradeoffs.length >= 2 && v.tradeoffs.length <= 4
    && v.tradeoffs.every((t) => typeof t === 'string' && t.length > 0)
    && typeof v.best_next_step === 'string' && v.best_next_step.length > 0
  );
  if (!baseOk) return false;
  // D.52 rule_citations: optional. If present, must be array of valid slugs.
  if (v.rule_citations !== undefined) {
    if (!Array.isArray(v.rule_citations)) return false;
    const validSlugs: RuleCitationSlug[] = ['safety_net', 'impulse_wait', 'daily_sps_floor'];
    if (!v.rule_citations.every((c) => typeof c === 'string' && (validSlugs as string[]).includes(c))) {
      return false;
    }
  }
  return true;
}

export function verdictDbValue(color: VerdictColor): 'green' | 'amber' | 'red' {
  switch (color) {
    case 'GREEN': return 'green';
    case 'YELLOW': return 'amber';
    case 'RED': return 'red';
  }
}
