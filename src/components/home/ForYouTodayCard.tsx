import React from 'react';
import { GuidanceItem } from '../../lib/guidance';
import { useNavigate } from 'react-router-dom';
import { Card } from '../primitives';

export function ForYouTodayCard({ items }: { items: GuidanceItem[] }) {
  const navigate = useNavigate();

  if (!items || items.length === 0) return null;

  return (
    <Card className="mb-3">
      <div className="text-base font-medium text-[#1A1A1A] mb-4">For you today</div>
      <div className="flex flex-col gap-3">
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.link)}
            className="flex items-center justify-between p-3 rounded-2xl bg-[#E4ECE6]/30 text-left hover:bg-[#E4ECE6]/60 transition-colors w-full"
          >
            <span className="text-sm text-[#1A1A1A]">{item.message}</span>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#5A6B5F] ml-2 flex-shrink-0"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        ))}
      </div>
    </Card>
  );
}
