// Phase C3 — structured verdict shape. Mirrored on the Edge Function side at
// supabase/functions/chat-respond/index.ts. Frontend treats AI responses as
// either prose (existing path) or structured (renders as VerdictCard).
//
// VerdictColor maps to saved_decisions.verdict enum on persist:
//   GREEN  → 'green'
//   YELLOW → 'amber'
//   RED    → 'red'

export type VerdictColor = 'GREEN' | 'YELLOW' | 'RED';

export interface StructuredVerdict {
  verdict_color: VerdictColor;
  verdict_line: string;
  body: string;
  tradeoffs: string[];
  best_next_step: string;
}

export function isValidStructured(s: unknown): s is StructuredVerdict {
  if (!s || typeof s !== 'object') return false;
  const v = s as Record<string, unknown>;
  return (
    (v.verdict_color === 'GREEN' || v.verdict_color === 'YELLOW' || v.verdict_color === 'RED')
    && typeof v.verdict_line === 'string' && v.verdict_line.length > 0
    && typeof v.body === 'string' && v.body.length > 0
    && Array.isArray(v.tradeoffs) && v.tradeoffs.length >= 2 && v.tradeoffs.length <= 4
    && v.tradeoffs.every((t) => typeof t === 'string' && t.length > 0)
    && typeof v.best_next_step === 'string' && v.best_next_step.length > 0
  );
}

export function verdictDbValue(color: VerdictColor): 'green' | 'amber' | 'red' {
  switch (color) {
    case 'GREEN': return 'green';
    case 'YELLOW': return 'amber';
    case 'RED': return 'red';
  }
}
