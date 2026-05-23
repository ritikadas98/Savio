import React from 'react';

export function TypingIndicator() {
  return (
    <div className="flex w-full mb-4 justify-start">
      <div className="w-8 h-8 rounded-full bg-[#E4ECE6] flex-shrink-0 mr-3 flex items-center justify-center">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 22 12 18 22 22 12 2"></polygon></svg>
      </div>
      <div className="bg-white border border-black/5 rounded-[20px] rounded-tl-sm px-4 py-3 flex items-center gap-1 h-[48px]">
        <div className="w-2 h-2 bg-secondary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-secondary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-secondary rounded-full animate-bounce"></div>
      </div>
    </div>
  );
}
