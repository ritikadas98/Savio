import React from 'react';
import { BottomNav } from '../components/layout/BottomNav';

export function GoalsPage() {
  return (
    <div className="flex flex-col h-full bg-[#E4ECE6]">
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-title font-medium mb-2">Goals</h1>
        <p className="text-secondary">Phase 4 — coming next</p>
      </div>
      <BottomNav />
    </div>
  );
}
