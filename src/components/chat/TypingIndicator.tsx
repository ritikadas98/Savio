import React from 'react';
import { Compass } from 'lucide-react';

export function TypingIndicator() {
  return (
    <div className="w-full mb-5 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-[#DCEEFF] flex items-center justify-center flex-shrink-0">
          <Compass size={14} className="text-[#0C447C]" />
        </div>
        <span className="font-semibold text-[#0C447C] text-sm">Savio</span>
      </div>

      <div className="pl-9 flex items-center gap-1.5 h-6" aria-label="Savio is thinking">
        <div className="w-2 h-2 bg-[#0C447C]/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <div className="w-2 h-2 bg-[#0C447C]/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <div className="w-2 h-2 bg-[#0C447C]/40 rounded-full animate-bounce" />
      </div>
    </div>
  );
}
