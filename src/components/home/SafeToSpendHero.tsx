import React from 'react';
import { today } from '../../lib/dates';

type Props = {
  amount: number;
  anchorDate: Date;
  // Optional delta vs prior reference (e.g. day-over-day). Phase 3 wires the
  // real value; until then this stays null and the pill is omitted.
  delta?: number | null;
};

export function SafeToSpendHero({ amount, anchorDate, delta = null }: Props) {
  const now = today();
  const diffDays = Math.ceil((anchorDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Gauge ceiling — high enough that the marker doesn't pin to the right edge
  // on a typical month.
  const ceiling = Math.max(amount * 1.5, 20000);
  const markerPosition = Math.min(Math.max(amount / ceiling, 0), 1) * 100;

  const formatINR = (n: number) => n.toLocaleString('en-IN');
  const ceilingLabel = ceiling >= 1000 ? `₹${Math.round(ceiling / 1000)}K` : `₹${formatINR(ceiling)}`;

  return (
    <div className="bg-white rounded-[32px] p-7 shadow-sm border border-black/5 flex flex-col mb-3">
      <div className="text-xs font-medium tracking-wider uppercase text-[#5A6B5F] mb-2">
        Safe to spend today
      </div>

      <div className="flex items-baseline gap-3 mb-5">
        <span className="text-5xl font-bold tracking-tight text-[#0C447C] leading-none">
          ₹{formatINR(amount)}
        </span>
        {delta != null && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#B2EF82]/30 text-[#2D5016]">
            {delta > 0 ? '+' : delta < 0 ? '−' : ''}₹{formatINR(Math.abs(delta))}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {/* Gradient bar with vertical line marker */}
        <div className="relative h-5 rounded-full overflow-hidden">
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(90deg, #FF6B6B 0%, #FFB84D 25%, #FFE066 50%, #7DD87D 75%, #5DADE2 100%)' }}
          />
          <div
            className="absolute top-0 bottom-0 w-1 bg-[#0C447C] rounded-sm transition-all duration-500"
            style={{ left: `${markerPosition}%`, transform: 'translateX(-50%)' }}
          />
        </div>

        {/* Endpoint labels + center caption */}
        <div className="flex items-center justify-between text-xs text-[#5A6B5F]">
          <span>₹0</span>
          <span className="text-center">
            {diffDays > 0 ? `${diffDays} days until salary on the 1st` : 'Payday!'}
          </span>
          <span>{ceilingLabel}</span>
        </div>
      </div>
    </div>
  );
}
