import React from 'react';
import { Calendar } from 'lucide-react';
import { formatMonthName } from '../../lib/dates';

type Props = {
  monthYear: string;
  onStart?: () => void;
};

export function MonthlyRitualBanner({ monthYear, onStart }: Props) {
  const monthName = formatMonthName(monthYear);

  return (
    <div className="rounded-2xl border-2 border-[#0C447C]/30 bg-white p-5 mb-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#DCEEFF] flex items-center justify-center flex-shrink-0">
        <Calendar size={20} className="text-[#0C447C]" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[#0C447C]">
          Your {monthName} check-in is ready
        </div>
        <div className="text-sm text-[#5A6B5F] mt-1">
          About 90 seconds. Closes out {monthName} and locks your safe-to-spend.
        </div>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="px-5 py-2.5 rounded-full bg-[#0C447C] text-white text-sm font-medium transition-opacity hover:opacity-90 flex-shrink-0"
      >
        Start
      </button>
    </div>
  );
}
