import React from 'react';
import { today } from '../../lib/dates';

export function SafeToSpendHero({ amount, anchorDate }: { amount: number; anchorDate: Date }) {
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);

  // Compute days until payday
  const now = today(); // DEMO_TODAY
  const diffTime = anchorDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Progress: ratio of safe-to-spend against a reasonable max buffer
  const maxBuffer = 20000;
  const percentage = Math.min(Math.max(amount / maxBuffer, 0), 1) * 100;

  return (
    <div className="bg-white rounded-[32px] p-7 shadow-sm border border-black/5 flex flex-col mb-3">
      <div className="text-secondary text-xs uppercase tracking-wider mb-2">Safe to spend today</div>
      <div className="flex items-baseline gap-2 mb-5">
        <div className="text-3xl font-medium text-primary leading-none">{formattedAmount}</div>
      </div>

      {/* Rainbow gradient progress bar */}
      <div className="relative w-full h-5 rounded-full bg-black/5 mb-3 overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
          style={{
            width: `${percentage}%`,
            background: 'linear-gradient(90deg, #FF6B6B 0%, #FFB84D 25%, #FFE066 50%, #7DD87D 75%, #5DADE2 100%)'
          }}
        />
        {/* Position marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-primary shadow-sm transition-all duration-500"
          style={{ left: `calc(${percentage}% - 10px)` }}
        />
      </div>

      <div className="flex justify-end text-micro text-tertiary">
        <span>{diffDays > 0 ? `${diffDays} days until salary` : 'Payday!'}</span>
      </div>
    </div>
  );
}
