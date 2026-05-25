import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Check } from 'lucide-react';
import { SaveDecisionButton } from './SaveDecisionButton';
import { Pill } from '../primitives';

// Savio's brand mark — a rainbow-gradient circle (NOT a compass icon).
// Compass is reserved for Priya's Strategist avatar in ProfilePill.
const SAVIO_GRADIENT = 'linear-gradient(135deg, #FF8F8F, #F4D123, #B2EF82, #58B9FF)';

export function MessageBubble({ message }: { message: any }) {
  const isUser = message.role === 'user';
  const metadata = message.ai_metadata || {};

  if (isUser) {
    return (
      <div className="flex w-full mb-4 justify-end">
        <div className="max-w-[80%] rounded-[20px] rounded-tr-sm px-4 py-3 bg-[#DCEEFF] text-[#0C447C]">
          <div className="text-body whitespace-pre-wrap">{message.content}</div>
        </div>
      </div>
    );
  }

  // Assistant message — renders as prose on canvas, no card background.
  const verified = metadata.verified === true;
  const showSaveDecision =
    metadata.is_verdict === true &&
    metadata.fallback_used !== true &&
    metadata.scope_filter_triggered == null;

  return (
    <div className="w-full mb-5 space-y-2">
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-full flex-shrink-0"
          style={{ background: SAVIO_GRADIENT }}
          aria-label="Savio"
        />
        <span className="font-semibold text-[#0C447C] text-sm">Savio</span>
        {verified && (
          <Pill
            variant="sage"
            icon={<Check size={11} strokeWidth={2.5} />}
            title="Numbers in this response were verified against your actual data."
          >
            Verified
          </Pill>
        )}
      </div>

      <div className="text-body text-[#1A1A1A] pl-8">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold text-[#0C447C]">{children}</strong>,
            em: ({ children }) => <em className="italic">{children}</em>,
            ul: ({ children }) => <ul className="list-disc pl-5 mb-3 last:mb-0 space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 last:mb-0 space-y-1">{children}</ol>,
            li: ({ children }) => <li>{children}</li>,
            code: ({ children }) => <code className="bg-black/5 px-1 py-0.5 rounded text-[0.9em]">{children}</code>,
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>

      {showSaveDecision && (
        <div className="pl-8">
          <SaveDecisionButton
            decisionText={message.content.slice(0, 100) + '...'}
            verdict="amber"
            amount={null}
            messageId={message.id}
          />
        </div>
      )}
    </div>
  );
}
