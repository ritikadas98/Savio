import ReactMarkdown from 'react-markdown';
import { Check, Target, Shield, Clock, Wallet } from 'lucide-react';
import { Card, Pill } from '../primitives';
import { SaveDecisionButton } from './SaveDecisionButton';
import { tokens } from '../../lib/design-tokens';
import { formatRelativeDate } from '../../lib/dates';
import type { StructuredVerdict, VerdictColor, RuleCitationSlug } from '../../lib/chat-types';

// Phase C3 — verdict card per JSX preview lines 421-475.
//
// Stream 0.5l restructure: original C3 implementation drifted from canonical
// in three ways that compounded into weak alignment + ambiguous identity:
//   1. Outer wrapper used `w-full` instead of alignSelf+maxWidth
//   2. Speaker badge sat OUTSIDE the Card; canonical puts it inside
//   3. Card used default uniform rounding instead of `4px 22px 22px 22px`
//      (sharp top-left = Savio's chat-bubble signature)
// All three fixed by mirroring JSX lines 421-475 structure exactly.

const VERDICT_PILL: Record<VerdictColor, 'sage' | 'yellow' | 'red'> = {
  GREEN: 'sage',
  YELLOW: 'yellow',
  RED: 'red',
};

// D.52 (Stream 0.5t piece #8) — labels + icons for the per-rule badges.
// Rendered above tradeoffs when rule_citations is non-empty. Kept inline
// rather than in design-tokens because they're verdict-card-specific and
// the icon mapping is tightly coupled to the rule slug enum.
const RULE_CITATION_LABEL: Record<RuleCitationSlug, string> = {
  safety_net:      'Safety net rule',
  impulse_wait:    'Impulse-wait rule',
  daily_sps_floor: 'Daily floor rule',
};
const RULE_CITATION_ICON: Record<RuleCitationSlug, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  safety_net:      Shield,
  impulse_wait:    Clock,
  daily_sps_floor: Wallet,
};

const SAVIO_GRADIENT = 'linear-gradient(135deg, #FF8F8F, #F4D123, #B2EF82, #58B9FF)';

interface Props {
  structured: StructuredVerdict;
  messageId: string;
  createdAt?: string | null;
  // C.27 (Stream 0.5p #6) — when true, hide the SaveDecisionButton at the
  // bottom of the card. Used when re-rendering a saved decision inside the
  // Goals tab's Saved Decisions section — the verdict is already saved, so
  // offering "Save this decision" again would be misleading.
  readOnly?: boolean;
}

export function VerdictCard({ structured, messageId, createdAt, readOnly = false }: Props) {
  const pillVariant = VERDICT_PILL[structured.verdict_color];
  const timeLabel = createdAt ? formatRelativeDate(createdAt) : 'just now';

  return (
    <div
      className="mb-5"
      style={{ alignSelf: 'flex-start', maxWidth: '92%' }}
    >
      <Card style={{ borderRadius: '4px 22px 22px 22px', padding: 16 }}>
        {/* Speaker badge INSIDE the card per JSX preview lines 423-432 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <div
            style={{ width: 20, height: 20, borderRadius: 999, background: SAVIO_GRADIENT }}
            aria-label="Savio"
          />
          <span style={{ fontSize: 12.5, color: tokens.p, fontWeight: 500 }}>Savio</span>
          <Pill
            variant={pillVariant}
            icon={<Check size={10} strokeWidth={3} />}
            title="Numbers in this verdict were verified against your actual data."
          >
            Verified
          </Pill>
        </div>

        {/* Verdict line */}
        <div
          style={{
            fontSize: 15, color: tokens.p, lineHeight: 1.45,
            fontWeight: 500, marginBottom: 10,
          }}
        >
          {structured.verdict_line}
        </div>

        {/* Body — markdown for **bold** numbers */}
        <div
          style={{
            fontSize: 13.5, color: tokens.s, lineHeight: 1.5,
            marginBottom: 12,
          }}
        >
          <ReactMarkdown
            components={{
              p: ({ children }) => <p style={{ margin: 0 }}>{children}</p>,
              strong: ({ children }) => <strong style={{ fontWeight: 500, color: tokens.avStop }}>{children}</strong>,
            }}
          >
            {structured.body}
          </ReactMarkdown>
        </div>

        {/* D.52 (Stream 0.5t #8) — rule citation badges. AI populates
            rule_citations[] when it references the user's stated rules in
            any of the four content fields. Rendered as small inline chips
            so the user can see at a glance which rules the verdict honored.
            Hidden when empty or absent (old saved_decisions rows). */}
        {structured.rule_citations && structured.rule_citations.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginBottom: 10,
            }}
          >
            {structured.rule_citations.map((slug) => {
              const Icon = RULE_CITATION_ICON[slug];
              return (
                <span
                  key={slug}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 10.5,
                    color: '#5A6B5F',
                    backgroundColor: 'rgba(59,109,17,0.06)',
                    border: '0.5px solid rgba(59,109,17,0.15)',
                    padding: '3px 8px',
                    borderRadius: 999,
                    lineHeight: 1.2,
                  }}
                  title={`Verdict references your ${RULE_CITATION_LABEL[slug].toLowerCase()}`}
                >
                  <Icon size={10} strokeWidth={2} />
                  {RULE_CITATION_LABEL[slug]}
                </span>
              );
            })}
          </div>
        )}

        {/* Tradeoffs callout */}
        <div
          style={{
            backgroundColor: tokens.cardSoft, borderRadius: 14,
            padding: 12, marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 11.5, color: tokens.t, fontWeight: 500,
              letterSpacing: 0.3, marginBottom: 6,
            }}
          >
            Tradeoffs
          </div>
          <ul
            style={{
              margin: 0, paddingLeft: 16,
              fontSize: 12.5, color: tokens.p, lineHeight: 1.55,
            }}
          >
            {structured.tradeoffs.map((item, i) => (
              <li key={i} style={{ marginBottom: i < structured.tradeoffs.length - 1 ? 4 : 0 }}>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Best-next-step callout — navy plate per JSX preview */}
        <div
          style={{
            display: 'flex', gap: 8, alignItems: 'flex-start',
            padding: '10px 12px', borderRadius: 14,
            backgroundColor: tokens.avPlate,
          }}
        >
          <Target
            size={14}
            color={tokens.avStop}
            strokeWidth={2}
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 11, color: tokens.avStop, fontWeight: 500,
                marginBottom: 2,
              }}
            >
              Best next step
            </div>
            <div style={{ fontSize: 12.5, color: tokens.avStop, lineHeight: 1.45 }}>
              {structured.best_next_step}
            </div>
          </div>
        </div>

        {/* Save link inside Card per JSX preview line 468. Hidden in
            readOnly mode (C.27) — when re-rendering an already-saved
            decision in Goals tab, offering "Save" again would mislead. */}
        {!readOnly && (
          <SaveDecisionButton
            decisionText={structured.verdict_line}
            verdict={structured.verdict_color}
            amount={null}
            messageId={messageId}
            structured={structured}
          />
        )}
      </Card>

      {/* Timestamp outside Card per JSX preview line 472-474 */}
      <div style={{ fontSize: 10.5, color: tokens.t, marginTop: 3 }}>
        Savio · {timeLabel}
      </div>
    </div>
  );
}
