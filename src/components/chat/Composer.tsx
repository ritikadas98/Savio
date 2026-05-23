import React, { useState } from 'react';

export function Composer({ onSend, disabled }: { onSend: (text: string) => void, disabled: boolean }) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled) {
      onSend(text);
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-[24px] border border-black/5 p-2 flex items-end shadow-sm">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask Savio anything..."
        disabled={disabled}
        className="flex-1 bg-transparent border-none resize-none px-3 py-2 max-h-32 text-body focus:outline-none disabled:opacity-50"
        rows={1}
      />
      <button 
        type="submit" 
        disabled={!text.trim() || disabled}
        className="w-10 h-10 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center flex-shrink-0 disabled:opacity-50 transition-opacity"
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
      </button>
    </form>
  );
}
