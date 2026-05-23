import React from 'react';

export function VerifiedBadge() {
  return (
    <div className="inline-flex items-center gap-1 bg-[#DEF2CB] text-[#3B6D11] px-2 py-0.5 rounded-full mt-2" title="Numbers in this response were verified against your actual data.">
      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      <span className="text-[11px] font-medium leading-none">Verified</span>
    </div>
  );
}
