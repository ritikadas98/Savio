import { Target, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, SectionHeader } from '../primitives';
import type { FocusGoalInsight } from '../../lib/guidance';

// Doc 1.16 + Stream 0.5-D: primary focus-goal insight card with target-icon
// plate (32×32 avPlate / Target icon T.avStop / size 15). Layout matches JSX
// preview lines 338-355.
//
// D.59 (Stream 0.5u piece #5) — section header renamed "For you today" →
// "Track your goals". Real-user testing flagged the original as vague; the
// section content has always been goal-progress insights (FocusGoalInsight),
// so the new label states what's actually rendered.
export function ForYouTodayCard({ insight }: { insight: FocusGoalInsight | null }) {
  const navigate = useNavigate();

  if (!insight) return null;

  return (
    <div className="mb-3">
      <SectionHeader title="Track your goals" />
      <Card>
        <button
          type="button"
          onClick={() => navigate(insight.link)}
          className="flex items-start w-full text-left hover:opacity-90 transition-opacity"
          style={{ gap: 12 }}
        >
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              backgroundColor: '#DCEEFF',
              color: '#0C447C',
              marginTop: 1,
            }}
          >
            <Target size={15} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 14, color: '#1A1A1A', fontWeight: 400, lineHeight: 1.35 }}>
              {insight.message}
            </div>
            <div style={{ fontSize: 12, color: '#5F5E5A', marginTop: 2 }}>
              {insight.subDetail}
            </div>
          </div>
          <ChevronRight size={18} className="text-[#888780] flex-shrink-0 mt-0.5" />
        </button>
      </Card>
    </div>
  );
}
