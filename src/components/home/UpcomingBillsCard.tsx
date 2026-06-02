import { Receipt } from 'lucide-react';
import { Card, SectionHeader } from '../primitives';
import type { UpcomingBill } from '../../lib/upcoming-bills';

// Stream 0.5-H: Upcoming Bills surface — between Categorization Banner and
// For You Today on the home page. Shows up to 4 fixed commitments due in the
// next 14 days, sorted by due_day_of_month. Empty state = don't render.
const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export function UpcomingBillsCard({ bills }: { bills: UpcomingBill[] }) {
  if (!bills || bills.length === 0) return null;

  return (
    <div className="mb-3">
      <SectionHeader title="Upcoming bills" />
      <Card className="!p-0">
        {bills.map((bill, i) => (
          <div
            key={bill.id}
            className="flex items-center"
            style={{
              gap: 12,
              padding: '12px 14px',
              borderBottom: i < bills.length - 1 ? '0.5px solid rgba(0,0,0,0.07)' : 'none',
            }}
          >
            <div
              className="flex-shrink-0 flex items-center justify-center"
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                backgroundColor: '#F4F4F2',
                color: '#5F5E5A',
              }}
            >
              <Receipt size={14} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 14, color: '#1A1A1A', fontWeight: 400, lineHeight: 1.2 }} className="truncate">
                {bill.label}
              </div>
              <div style={{ fontSize: 11.5, color: '#888780', marginTop: 1 }} className="truncate">
                {bill.dueRelative}
                {bill.category ? ` · ${bill.category}` : ''}
              </div>
            </div>
            <div style={{ fontSize: 14, color: '#1A1A1A', fontWeight: 500 }} className="flex-shrink-0">
              {formatINR(bill.amount)}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
