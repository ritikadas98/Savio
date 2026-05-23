import React from 'react';
import { GuidanceItem } from '../../lib/guidance';
import { useNavigate } from 'react-router-dom';

export function ForYouTodayCard({ items }: { items: GuidanceItem[] }) {
  const navigate = useNavigate();

  if (!items || items.length === 0) return null;

  return (
    <div className="bg-white rounded-[24px] p-5 shadow-sm border border-black/5 mb-3">
      <div className="text-subheading font-medium text-primary mb-4">For you today</div>
      <div className="flex flex-col gap-3">
        {items.map(item => (
          <div 
            key={item.id} 
            onClick={() => navigate(item.link)}
            className="flex items-center justify-between p-3 rounded-[16px] bg-[#E4ECE6]/30 cursor-pointer hover:bg-[#E4ECE6]/60 transition-colors"
          >
            <span className="text-body text-primary">{item.message}</span>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-secondary ml-2 flex-shrink-0"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        ))}
      </div>
    </div>
  );
}
