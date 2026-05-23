import React from 'react';

export function CategorizationBanner({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <div className="bg-white rounded-[16px] p-4 shadow-sm border border-black/5 flex items-center justify-between mb-3 cursor-pointer hover:bg-black/5 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#E4ECE6] flex items-center justify-center text-primary">
          <span className="text-caption font-medium">{count}</span>
        </div>
        <div>
          <div className="text-body font-medium text-primary">Categorize transactions</div>
          <div className="text-caption text-secondary">Tap to review</div>
        </div>
      </div>
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-secondary"><polyline points="9 18 15 12 9 6"></polyline></svg>
    </div>
  );
}
