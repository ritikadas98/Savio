import React from 'react';

export function SuggestedChips({ onSelect, disabled }: { onSelect: (text: string) => void, disabled: boolean }) {
  const suggestions = [
    "Am I on track?",
    "Can I afford a ₹5,000 watch?",
    "What's my safe-to-spend?",
    "Show me where I'm spending"
  ];

  return (
    <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
      {suggestions.map(text => (
        <button
          key={text}
          onClick={() => onSelect(text)}
          disabled={disabled}
          className="whitespace-nowrap px-4 py-2 rounded-full border border-black/10 bg-white text-caption text-primary hover:bg-black/5 disabled:opacity-50 transition-colors"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
