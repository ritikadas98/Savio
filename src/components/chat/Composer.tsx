import { useState } from 'react';
import { Send } from 'lucide-react';

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
        className="flex-1 bg-transparent border-none resize-none px-3 py-2 max-h-32 focus:outline-none disabled:opacity-50"
        style={{ fontSize: 14, lineHeight: 1.4, color: '#1A1A1A', fontFamily: 'inherit' }}
        rows={1}
      />
      <button 
        type="submit" 
        disabled={!text.trim() || disabled}
        className="w-10 h-10 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center flex-shrink-0 disabled:opacity-50 transition-opacity"
      >
        <Send size={18} strokeWidth={2} />
      </button>
    </form>
  );
}
