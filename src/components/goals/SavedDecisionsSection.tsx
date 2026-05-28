import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Card } from '../primitives';
import { VerdictCard } from '../chat/VerdictCard';
import { tokens } from '../../lib/design-tokens';
import { formatRelativeDate } from '../../lib/dates';
import type { StructuredVerdict } from '../../lib/chat-types';

// C.27 (Stream 0.5p piece #6) — Saved Decisions return path.
//
// Pre-0.5p: Save Decision wrote to saved_decisions table but the user
// never saw saves anywhere. Real-user testing surfaced the dead-end
// feeling. Phase 3 stepping-stone version of Framing B (verdict-outcome
// loop): Goals tab shows the most-recent 3 saves below the goal cards.
// Each row collapsible — expanding re-renders the original verdict via
// the existing VerdictCard component with readOnly={true} (added in
// this stream so the saved card doesn't re-offer "Save this decision").
// Empty state copy explicitly frames the loop intent. Full Framing B
// (outcome follow-up state, regret-pattern feedback) stays V2.

export interface SavedDecisionRow {
  id: string;
  decision_text: string | null;
  verdict: 'green' | 'amber' | 'red' | string | null;  // DB enum (lowercase)
  decision_data: StructuredVerdict | null;
  decided_at: string;
}

const VERDICT_STRIPE_COLOR: Record<string, string> = {
  green: '#3B6D11',
  amber: '#854F0B',
  red:   '#791F1F',
};

export function SavedDecisionsSection({ decisions }: { decisions: SavedDecisionRow[] }) {
  if (decisions.length === 0) {
    return (
      <div style={{ marginTop: 16 }}>
        <div
          style={{
            fontSize: 11,
            color: tokens.t,
            fontWeight: 500,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            padding: '0 6px 8px',
          }}
        >
          Saved decisions
        </div>
        <Card>
          <div style={{ padding: '4px 4px' }}>
            <div style={{ fontSize: 13.5, color: tokens.p, marginBottom: 4 }}>
              Nothing saved yet.
            </div>
            <div style={{ fontSize: 12, color: tokens.s, lineHeight: 1.5 }}>
              When you save a chat verdict, it appears here for you to revisit.
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          fontSize: 11,
          color: tokens.t,
          fontWeight: 500,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          padding: '0 6px 8px',
        }}
      >
        Saved decisions
      </div>
      <div className="flex flex-col" style={{ gap: 10 }}>
        {decisions.map(d => <SavedDecisionRowCard key={d.id} decision={d} />)}
      </div>
    </div>
  );
}

function SavedDecisionRowCard({ decision }: { decision: SavedDecisionRow }) {
  const [expanded, setExpanded] = useState(false);
  const stripe = VERDICT_STRIPE_COLOR[decision.verdict ?? ''] ?? tokens.t;
  const canExpand = decision.decision_data != null;

  return (
    <Card>
      <button
        type="button"
        onClick={() => canExpand && setExpanded(e => !e)}
        className="w-full text-left flex items-center gap-3 hover:bg-black/[0.02] transition-colors"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: canExpand ? 'pointer' : 'default',
          fontFamily: 'inherit',
        }}
      >
        {/* Verdict color stripe — preserves the original verdict signal
            without re-using full card chrome. */}
        <div
          style={{
            width: 3,
            alignSelf: 'stretch',
            backgroundColor: stripe,
            borderRadius: 999,
            flexShrink: 0,
          }}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 14, color: tokens.p, fontWeight: 500, lineHeight: 1.35 }}>
            {decision.decision_text ?? 'Saved decision'}
          </div>
          <div style={{ fontSize: 11.5, color: tokens.t, marginTop: 2 }}>
            Saved {formatRelativeDate(decision.decided_at)}
          </div>
        </div>
        {canExpand && (
          <ChevronRight
            size={18}
            className="text-[#888780] flex-shrink-0"
            style={{
              transform: expanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 150ms ease',
            }}
            aria-hidden
          />
        )}
      </button>

      {expanded && decision.decision_data && (
        <div style={{ marginTop: 12 }}>
          <VerdictCard
            structured={decision.decision_data}
            messageId={decision.id}
            createdAt={decision.decided_at}
            readOnly
          />
        </div>
      )}
    </Card>
  );
}
