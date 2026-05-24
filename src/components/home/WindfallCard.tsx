import React from 'react';
import { Sparkles, X } from 'lucide-react';

type Props = {
  amount: number;
  source: string;
  onDismiss?: () => void;
  onAllocate?: () => void;
};

export function WindfallCard({ amount, source, onDismiss, onAllocate }: Props) {
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

  return (
    <div className="rounded-2xl border-2 border-[#F4D123]/40 bg-white p-5 space-y-3 mb-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#F4D123]/20 flex items-center justify-center flex-shrink-0">
          <Sparkles size={20} className="text-[#B8860B]" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm text-[#5A6B5F] mb-0.5">{source}</div>
          <div className="font-semibold text-[#0C447C]">
            {formattedAmount} landed today — well above your usual.
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-[#5A6B5F] hover:text-[#0C447C] transition-colors flex-shrink-0"
        >
          <X size={18} />
        </button>
      </div>

      <p className="text-sm text-[#5A6B5F] leading-relaxed">
        Money that breaks pattern is the easiest to spend without noticing. Want to spend 60 seconds deciding what this is for?
      </p>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onAllocate}
          className="px-5 py-2.5 rounded-full bg-[#0C447C] text-white text-sm font-medium transition-opacity hover:opacity-90"
        >
          Allocate now
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="px-5 py-2.5 rounded-full bg-white border border-[#0C447C]/20 text-[#0C447C] text-sm font-medium transition-colors hover:bg-[#0C447C]/5"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
