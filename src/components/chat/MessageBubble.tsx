import React from 'react';
import ReactMarkdown from 'react-markdown';
import { VerdictCard } from './VerdictCard';
import { Card } from '../primitives';
import { tokens } from '../../lib/design-tokens';
import { formatRelativeDate } from '../../lib/dates';
import { isValidStructured } from '../../lib/chat-types';

// Savio's brand mark — a rainbow-gradient circle (NOT a compass icon).
// Compass is reserved for Priya's Strategist avatar in ProfilePill.
const SAVIO_GRADIENT = 'linear-gradient(135deg, #FF8F8F, #F4D123, #B2EF82, #58B9FF)';

// Stream 0.5c sizes per JSX preview lines 408-475:
//   User bubble body:      14 / lh 1.4 / T.avStop (line 412)
//   "Savio" speaker label: 12.5 / 500 / T.p (line 428)
//   Assistant prose body:  13.5 / 1.5 / T.p (lines 437-439)
//   Inline <strong>:       500 / T.avStop (kept — deliberate navy emphasis)
export function MessageBubble({ message }: { message: any }) {
  const isUser = message.role === 'user';
  const metadata = message.ai_metadata || {};

  if (isUser) {
    return (
      <div className="flex w-full mb-4 justify-end">
        <div
          className="max-w-[80%] rounded-[20px] rounded-tr-sm bg-[#DCEEFF] text-[#0C447C]"
          style={{ padding: '10px 14px' }}
        >
          <div
            className="whitespace-pre-wrap"
            style={{ fontSize: 14, lineHeight: 1.4 }}
          >
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // Phase C3 — structured verdict path. Edge Function returns
  // ai_metadata.structured = { verdict_color, verdict_line, body, tradeoffs[],
  // best_next_step } when the user query matched a verdict trigger. Frontend
  // routes off shape, not query type. Anything not matching the schema falls
  // through to the prose-bubble path (silent fallback per spec discipline).
  if (isValidStructured(metadata.structured)) {
    return (
      <VerdictCard
        structured={metadata.structured}
        messageId={message.id}
        createdAt={message.created_at}
      />
    );
  }

  // Stream 0.5m — prose path matches VerdictCard's wrapper pattern:
  //   alignSelf wrapper + Card with asymmetric border-radius + speaker
  //   badge inside the Card + timestamp outside.
  // Differences from VerdictCard:
  //   - NO Verified pill (verified is a structured-response signal — showing
  //     it on prose dilutes its meaning)
  //   - NO Tradeoffs / Best Next Step callouts (those are verdict-only)
  //   - NO Save link (Save is bound to structured verdicts only; verdict-
  //     eligible queries that fell back to prose lack the structured math
  //     a Save would capture)
  const timeLabel = message.created_at ? formatRelativeDate(message.created_at) : 'just now';

  return (
    <div className="mb-5" style={{ alignSelf: 'flex-start', maxWidth: '92%' }}>
      <Card style={{ borderRadius: '4px 22px 22px 22px', padding: 16 }}>
        {/* Speaker badge INSIDE the card per JSX preview Pattern 2 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <div
            style={{ width: 20, height: 20, borderRadius: 999, background: SAVIO_GRADIENT }}
            aria-label="Savio"
          />
          <span style={{ fontSize: 12.5, color: tokens.p, fontWeight: 500 }}>Savio</span>
        </div>

        {/* Prose body — markdown labels render as bold navy per 0.5m §3.2 */}
        <div style={{ fontSize: 13.5, color: tokens.p, lineHeight: 1.55 }}>
          <ReactMarkdown
            components={{
              p: ({ children }) => <p style={{ margin: '0 0 10px 0' }} className="last:!mb-0">{children}</p>,
              strong: ({ children }) => <strong style={{ fontWeight: 500, color: tokens.avStop }}>{children}</strong>,
              em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
              ul: ({ children }) => <ul style={{ margin: '0 0 10px 0', paddingLeft: 18 }} className="last:!mb-0 list-disc space-y-1">{children}</ul>,
              ol: ({ children }) => <ol style={{ margin: '0 0 10px 0', paddingLeft: 18 }} className="last:!mb-0 list-decimal space-y-1">{children}</ol>,
              li: ({ children }) => <li>{children}</li>,
              code: ({ children }) => <code className="bg-black/5 px-1 py-0.5 rounded text-[0.9em]">{children}</code>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </Card>

      {/* Timestamp outside Card per JSX preview Pattern 2 */}
      <div style={{ fontSize: 10.5, color: tokens.t, marginTop: 3 }}>
        Savio · {timeLabel}
      </div>
    </div>
  );
}
