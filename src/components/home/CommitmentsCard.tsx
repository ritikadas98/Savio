import React from 'react';

export function CommitmentsCard({ ratio, total }: { ratio: string, total: number }) {
  return (
    <div className="bg-white rounded-[24px] p-4 shadow-sm border border-black/5 flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-[#DEF2CB] flex items-center justify-center text-[#3B6D11]">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <div>
          <div className="text-body font-medium text-primary">Commitments on track</div>
          <div className="text-caption text-secondary">All caught up this month</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-title font-medium text-primary">{ratio}</div>
        <div className="text-caption text-secondary">paid</div>
      </div>
    </div>
  );
}
