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

  // Compute rough gradient width (mocked for MVP)
  const maxBuffer = 20000;
  const percentage = Math.min(Math.max(amount / maxBuffer, 0), 1) * 100;

  return (
    <div className="bg-white rounded-[32px] p-7 shadow-sm border border-black/5 flex flex-col mb-3">
      <div className="text-secondary text-body mb-2">Safe to spend today</div>
      <div className="flex items-baseline mb-4">
        <div className="text-display font-medium text-primary">{formattedAmount}</div>
      </div>
      
      {/* Rainbow Gradient progress bar */}
      <div className="relative w-full h-1.5 rounded-full bg-black/5 mb-2 overflow-hidden">
        <div 
          className="absolute top-0 left-0 h-full rounded-full"
          style={{
            width: `${percentage}%`,
            background: 'linear-gradient(90deg, #FF8F8F 0%, #F4D123 50%, #B2EF82 100%)'
          }}
        />
      </div>
      
      <div className="flex justify-between text-micro text-tertiary">
        <span>₹0</span>
        <span>{diffDays} days until salary</span>
      </div>
    </div>
  );
}
