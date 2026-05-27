import React from 'react';
import { Check } from 'lucide-react';

export function VerifiedBadge() {
  return (
    <div className="inline-flex items-center gap-1 bg-[#DEF2CB] text-[#3B6D11] px-2 py-0.5 rounded-full mt-2" title="Numbers in this response were verified against your actual data.">
      <Check size={11} strokeWidth={2.5} />
      <span className="text-[11px] font-medium leading-none">Verified</span>
    </div>
  );
}
