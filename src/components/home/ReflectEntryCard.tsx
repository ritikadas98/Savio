import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ChevronRight } from 'lucide-react';
import { Card } from '../primitives';
import { tokens } from '../../lib/design-tokens';

// D.24 (Stream 0.5p piece #2) — Home entry point for the Reflect surface.
//
// Real-user testers were missing the Reflect tab via bottom-nav only.
// This card sits between the safe-to-spend hero and CommitmentsCard,
// mirroring the existing actionable-card design language (windfall card /
// ritual banner). Hidden when there's nothing to reflect on — no clutter,
// honest about the user's current state.

type Props = {
  unlabeledCount: number;
};

export function ReflectEntryCard({ unlabeledCount }: Props) {
  const navigate = useNavigate();

  if (unlabeledCount <= 0) return null;

  return (
    <Card accentColor="green" className="mb-3">
      <button
        type="button"
        onClick={() => navigate('/reflect')}
        className="w-full flex items-center gap-3 text-left hover:opacity-95 transition-opacity"
        style={{ background: 'transparent', border: 'none', padding: 0, fontFamily: 'inherit', cursor: 'pointer' }}
      >
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 40, height: 40, borderRadius: 999,
            backgroundColor: '#DEF2CB', color: '#3B6D11',
          }}
        >
          <Sparkles size={18} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 14.5, color: tokens.p, fontWeight: 500, lineHeight: 1.3 }}>
            Reflect on your spending
          </div>
          <div style={{ fontSize: 12, color: tokens.s, marginTop: 2, lineHeight: 1.4 }}>
            {unlabeledCount} {unlabeledCount === 1 ? 'transaction' : 'transactions'} waiting for reflection
          </div>
        </div>
        <ChevronRight size={18} className="text-[#888780] flex-shrink-0" aria-hidden />
      </button>
    </Card>
  );
}
