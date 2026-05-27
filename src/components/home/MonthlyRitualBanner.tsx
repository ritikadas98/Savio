import React from 'react';
import { Calendar } from 'lucide-react';
import { formatMonthName } from '../../lib/dates';
import { Card } from '../primitives';

type Props = {
  monthYear: string;
  onStart?: () => void;
};

export function MonthlyRitualBanner({ monthYear, onStart }: Props) {
  const monthName = formatMonthName(monthYear);

  return (
    <Card accentColor="blue" className="mb-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#DCEEFF] flex items-center justify-center flex-shrink-0">
        <Calendar size={20} className="text-[#0C447C]" />
      </div>

      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 14.5, color: '#1A1A1A', fontWeight: 500, lineHeight: 1.35 }}>
          Your {monthName} check-in is ready
        </div>
        <div style={{ fontSize: 12, color: '#5F5E5A', marginTop: 2 }}>
          About 90 seconds. Closes out {monthName} and locks your safe-to-spend.
        </div>
      </div>

      {/* Stream 0.5-C revision: button sized per JSX preview line 240-247 —
          padding 8/14, fontSize 12.5, no min-width. Compact size leaves
          enough horizontal room for the title to fit inside the bezel. */}
      <button
        type="button"
        onClick={onStart}
        className="rounded-full bg-[#1A1A1A] text-white font-medium transition-opacity hover:opacity-90 flex-shrink-0"
        style={{ padding: '8px 14px', fontSize: 12.5, fontFamily: 'inherit' }}
      >
        Start
      </button>
    </Card>
  );
}
