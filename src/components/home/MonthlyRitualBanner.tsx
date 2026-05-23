import React from 'react';

export function MonthlyRitualBanner({ monthYear }: { monthYear: string }) {
  return (
    <div className="bg-[#FCF1CC] rounded-[16px] p-4 shadow-sm border border-[#854F0B]/10 flex items-center justify-between mb-3 cursor-pointer hover:bg-[#FBE9B3] transition-colors">
      <div className="flex items-center gap-3">
        <div className="text-[#854F0B]">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        </div>
        <div>
          <div className="text-body font-medium text-[#854F0B]">Monthly check-in ready</div>
          <div className="text-caption text-[#854F0B]/80">{monthYear} • Takes 90 seconds</div>
        </div>
      </div>
      <svg width="16" height="16" fill="none" stroke="#854F0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
    </div>
  );
}
