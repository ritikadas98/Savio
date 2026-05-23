import React from 'react';
import { parseDate } from '../../lib/dates';

export function RecentTransactionsList({ transactions }: { transactions: any[] }) {
  if (!transactions || transactions.length === 0) return null;

  return (
    <div className="bg-white rounded-[24px] p-5 shadow-sm border border-black/5 mb-6">
      <div className="flex justify-between items-center mb-4">
        <div className="text-subheading font-medium text-primary">Recent transactions</div>
        <button className="text-caption text-secondary hover:text-primary transition-colors">See all</button>
      </div>
      <div className="flex flex-col gap-4">
        {transactions.map(t => (
          <div key={t.id} className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#E4ECE6] flex items-center justify-center text-primary">
                <span className="text-caption uppercase">{t.merchant?.slice(0, 1) || '?'}</span>
              </div>
              <div>
                <div className="text-body font-medium text-primary line-clamp-1">{t.merchant || 'Unknown'}</div>
                <div className="flex gap-2 items-center">
                  <span className="text-micro text-tertiary">
                    {parseDate(t.occurred_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                  {t.category && (
                    <>
                      <span className="text-micro text-tertiary">•</span>
                      <span className="text-micro bg-black/5 px-1.5 py-0.5 rounded text-secondary">{t.category}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className={`text-body font-medium ${t.direction === 'credit' ? 'text-[#3B6D11]' : 'text-primary'}`}>
              {t.direction === 'credit' ? '+' : ''}
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(t.amount)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
