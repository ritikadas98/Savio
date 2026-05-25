import React from 'react';
import { parseDate } from '../../lib/dates';
import { Card, SectionHeader, Row } from '../primitives';

export function RecentTransactionsList({ transactions }: { transactions: any[] }) {
  if (!transactions || transactions.length === 0) return null;

  const formatINR = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  return (
    <Card className="mb-6">
      <SectionHeader
        title="Recent transactions"
        action={
          <button className="text-xs text-[#5A6B5F] hover:text-[#1A1A1A] transition-colors">See all</button>
        }
      />
      <div className="flex flex-col">
        {transactions.map(t => {
          const dateStr = parseDate(t.occurred_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          const isCredit = t.direction === 'credit';
          return (
            <Row
              key={t.id}
              icon={
                <div className="w-10 h-10 rounded-full bg-[#E4ECE6] flex items-center justify-center text-[#1A1A1A]">
                  <span className="text-xs uppercase font-medium">{t.merchant?.slice(0, 1) || '?'}</span>
                </div>
              }
              label={<span className="line-clamp-1">{t.merchant || 'Unknown'}</span>}
              sublabel={
                <span className="flex gap-2 items-center">
                  <span>{dateStr}</span>
                  {t.category && (
                    <>
                      <span className="text-[#8B948E]">•</span>
                      <span className="text-[10px] bg-black/5 px-1.5 py-0.5 rounded text-[#5A6B5F]">{t.category}</span>
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
