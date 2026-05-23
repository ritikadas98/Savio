import React from 'react';

export function WindfallCard({ amount, detectedAt }: { amount: number, detectedAt: string }) {
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);

  return (
    <div className="bg-[#DCEEFF] rounded-[24px] p-5 shadow-sm border border-[#0C447C]/10 mb-3">
      <div className="flex items-start justify-between mb-2">
        <div className="text-body font-medium text-[#0C447C]">We noticed {formattedAmount} landed</div>
        <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center text-[#0C447C]">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="12 5 19 12 12 19"></polyline><line x1="19" y1="12" x2="5" y2="12"></line></svg>
        </div>
      </div>
      <p className="text-caption text-[#0C447C]/80 mb-4">
        Money that breaks normal patterns is the easiest to spend without noticing. Want to spend 60 seconds deciding what this is for?
      </p>
      <div className="flex gap-2">
        <button className="flex-1 bg-[#0C447C] text-white py-2.5 rounded-full text-caption font-medium transition-opacity hover:opacity-90">
          Allocate now
        </button>
        <button className="flex-1 bg-white/50 text-[#0C447C] py-2.5 rounded-full text-caption font-medium transition-colors hover:bg-white/70">
          Skip for now
        </button>
      </div>
    </div>
  );
}
