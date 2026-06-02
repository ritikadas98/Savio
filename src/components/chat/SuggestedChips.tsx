
// Stream 0.5c-C: sizes per JSX preview line 537-547.
//   padding: 8px 14px, borderRadius: 999, fontSize: 12
//   border: 0.5px solid T.borderHover, color: T.p, bg: T.card
export function SuggestedChips({ onSelect, disabled }: { onSelect: (text: string) => void, disabled: boolean }) {
  const suggestions = [
    "Can I afford a ₹5,000 watch?",
    "Am I on track?",
    "What's my safe-to-spend?",
    "Show me where I'm spending"
  ];

  return (
    <div className="flex flex-wrap" style={{ gap: 6 }}>
      {suggestions.map(text => (
        <button
          key={text}
          type="button"
          onClick={() => onSelect(text)}
          disabled={disabled}
          className="hover:bg-black/5 disabled:opacity-50 transition-colors"
          style={{
            padding: '8px 14px',
            borderRadius: 999,
            fontSize: 12,
            border: '0.5px solid rgba(0,0,0,0.14)',
            backgroundColor: '#FFFFFF',
            color: '#1A1A1A',
            fontFamily: 'inherit',
            cursor: disabled ? 'default' : 'pointer',
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
