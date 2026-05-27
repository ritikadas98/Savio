import React from 'react';
import { formatRelativeDate } from '../../lib/dates';
import { getMerchantIcon } from '../../lib/merchant-icons';
import { Card, SectionHeader, Row } from '../primitives';

// Doc 1.16 Stream C: per-merchant icons sourced from shared src/lib/
// merchant-icons.ts (extracted in Phase B2 so the Reflect surface can reuse
// the same mapping). Substring match, fallback Receipt.

export function RecentTransactionsList({ transactions }: { transactions: any[] }) {
  if (!transactions || transactions.length === 0) return null;

  const formatINR = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  return (
    <Card className="mb-6">
      <SectionHeader
        title="Recent transactions"
        action={
          <button className="text-xs text-[#5F5E5A] hover:text-[#1A1A1A] transition-colors">See all</button>
        }
      />
      <div className="flex flex-col">
        {transactions.map(t => {
          const isCredit = t.direction === 'credit';
          const Icon = getMerchantIcon(t.merchant);
          return (
            <Row
              key={t.id}
              icon={
                <div className="w-10 h-10 rounded-full bg-cardSoft flex items-center justify-center text-[#5F5E5A]">
                  <Icon size={18} strokeWidth={2} />
                </div>
              }
              label={<span className="line-clamp-1">{t.merchant || 'Unknown'}</span>}
              sublabel={
                <span className="flex gap-2 items-center">
                  <span>{formatRelativeDate(t.occurred_at)}</span>
                  {t.category && (
                    <>
                      <span className="text-[#888780]">•</span>
                      <span className="text-[10px] bg-black/5 px-1.5 py-0.5 rounded text-[#5F5E5A]">{t.category}</span>
                    </>
                  )}
                </span>
              }
              value={
                <span className={isCredit ? 'text-[#3B6D11]' : 'text-[#1A1A1A]'}>
                  {isCredit ? '+' : ''}{formatINR(t.amount)}
                </span>
              }
              className="!px-0"
            />
          );
        })}
      </div>
    </Card>
  );
}
