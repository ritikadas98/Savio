
// Matches the SAVIO_GRADIENT in MessageBubble — Savio's brand mark.
const SAVIO_GRADIENT = 'linear-gradient(135deg, #FF8F8F, #F4D123, #B2EF82, #58B9FF)';

export function TypingIndicator() {
  return (
    <div className="w-full mb-5 space-y-2">
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-full flex-shrink-0"
          style={{ background: SAVIO_GRADIENT }}
          aria-label="Savio"
        />
        <span className="font-medium text-[#0C447C] text-sm">Savio</span>
      </div>

      <div className="pl-8 flex items-center gap-1.5 h-6" aria-label="Savio is thinking">
        <div className="w-2 h-2 bg-[#0C447C]/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <div className="w-2 h-2 bg-[#0C447C]/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <div className="w-2 h-2 bg-[#0C447C]/40 rounded-full animate-bounce" />
      </div>
    </div>
  );
}
