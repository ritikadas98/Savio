import React from 'react';
import { VerifiedBadge } from './VerifiedBadge';
import { SaveDecisionButton } from './SaveDecisionButton';

export function MessageBubble({ message }: { message: any }) {
  const isUser = message.role === 'user';
  
  return (
    <div className={\`flex w-full mb-4 \${isUser ? 'justify-end' : 'justify-start'}\`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-[#E4ECE6] flex-shrink-0 mr-3 flex items-center justify-center">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 22 12 18 22 22 12 2"></polygon></svg>
        </div>
      )}
      <div className={\`max-w-[80%] rounded-[20px] px-4 py-3 \${isUser ? 'bg-[#DCEEFF] text-[#0C447C] rounded-tr-sm' : 'bg-white border border-black/5 rounded-tl-sm text-primary'}\`}>
        <div className="text-body whitespace-pre-wrap">{message.content}</div>
        
        {!isUser && message.ai_metadata?.verified === true && (
          <VerifiedBadge />
        )}
        
        {!isUser && message.ai_metadata?.is_verdict === true && (
          <SaveDecisionButton 
            decisionText={message.content.slice(0, 100) + '...'} 
            verdict="amber" // MVP simplification
            amount={null}
            messageId={message.id} 
          />
        )}
      </div>
    </div>
  );
}
