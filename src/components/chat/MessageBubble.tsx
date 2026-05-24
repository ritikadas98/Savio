import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Compass } from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';
import { SaveDecisionButton } from './SaveDecisionButton';

export function MessageBubble({ message }: { message: any }) {
  const isUser = message.role === 'user';
  const metadata = message.ai_metadata || {};

  const showVerified = !isUser && metadata.verified === true;
  const showSaveDecision =
    !isUser &&
    metadata.is_verdict === true &&
    metadata.fallback_used !== true &&
    metadata.scope_filter_triggered == null;

  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-[#DCEEFF] flex-shrink-0 mr-3 flex items-center justify-center">
          <Compass size={16} className="text-[#0C447C]" />
        </div>
      )}
      <div className={`max-w-[80%] rounded-[20px] px-4 py-3 ${isUser ? 'bg-[#DCEEFF] text-[#0C447C] rounded-tr-sm' : 'bg-white border border-black/5 rounded-tl-sm text-primary'}`}>
        {isUser ? (
          <div className="text-body whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="text-body">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold text-[#0C447C]">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                ul: ({ children }) => <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-0.5">{children}</ol>,
                li: ({ children }) => <li>{children}</li>,
                code: ({ children }) => <code className="bg-black/5 px-1 py-0.5 rounded text-[0.9em]">{children}</code>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {showVerified && <VerifiedBadge />}

        {showSaveDecision && (
          <SaveDecisionButton
            decisionText={message.content.slice(0, 100) + '...'}
            verdict="amber"
            amount={null}
            messageId={message.id}
          />
        )}
      </div>
    </div>
  );
}
