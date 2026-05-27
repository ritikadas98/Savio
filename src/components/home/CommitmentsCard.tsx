import React from 'react';
import { Calendar } from 'lucide-react';
import { Card } from '../primitives';

type Props = {
  /** Count of commitment-linked transactions in this week's date range whose
   *  commitment_id matches one of this week's due commitments. */
  paidThisWeek: number;
  /** Count of fixed commitments with due_day_of_month inside the current
   *  7-day window. Variable budgets are excluded (they're spending buckets,
   *  not scheduled debits). */
  totalThisWeek: number;
};

export function CommitmentsCard({ paidThisWeek, totalThisWeek }: Props) {
  // Three states for the subtitle, depending on what's outstanding:
  //   - nothing scheduled this week: "Nothing due this week"
  //   - some paid, some pending:     "N due this week"
  //   - all paid:                    "All paid this week"
  // On the anchor day itself, paidThisWeek=0 / totalThisWeek=N → subtitle
  // shows "N due this week" — the honest read of fresh-month state.
  const remaining = Math.max(0, totalThisWeek - paidThisWeek);
  let subtitle: string;
  if (totalThisWeek === 0) {
    subtitle = 'Nothing due this week';
  } else if (remaining === 0) {
    subtitle = 'All paid this week';
  } else {
    subtitle = `${remaining} due this week`;
  }

  return (
    <Card className="flex items-center justify-between mb-3 !p-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-[#DEF2CB] flex items-center justify-center text-[#3B6D11] flex-shrink-0">
          <Calendar size={20} strokeWidth={2} />
        </div>
        <div>
          <div style={{ fontSize: 15, color: '#1A1A1A', fontWeight: 400 }}>Commitments on track</div>
          <div style={{ fontSize: 12.5, color: '#5F5E5A', marginTop: 2 }}>{subtitle}</div>
        </div>
      </div>
      <div className="text-right flex-shrink-0 flex items-baseline gap-0.5">
        <span style={{ fontSize: 26, fontWeight: 500, color: '#1A1A1A', lineHeight: 1 }}>
          {paidThisWeek}
        </span>
        <span style={{ fontSize: 16, fontWeight: 400, color: '#5F5E5A', lineHeight: 1 }}>
          /{totalThisWeek}
        </span>
      </div>
    </Card>
  );
}
