import React from 'react';

export function WindfallCard({ amount, source }: { amount: number; source: string }) {
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);

  return (
    <div className="bg-[#DCEEFF] rounded-[24px] p-5 shadow-sm border border-[#0C447C]/10 mb-3">
      <div className="mb-2">
        <div className="text-caption text-[#0C447C]/70 mb-0.5">{source}</div>
        <div className="text-body font-medium text-[#0C447C]">We noticed {formattedAmount} landed</div>
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
