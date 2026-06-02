import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, SectionHeader } from '../primitives';
import { tokens } from '../../lib/design-tokens';
import type { ReflectionPatternInsight } from '../../lib/guidance';

// Doc 1.16 Stream F: secondary register on the home surface — lighter visual
// weight than ForYouTodayCard, lives below it with extra top spacing to read
// as a separate moment. Uses Card variant="inset" (p-3) + cardSoft background
// so it feels like an aside rather than a primary call to action.
//
// When Doc 2 ships and designs the proper regret-rate surface on /reflect,
// this callout can either link there as a teaser or be repositioned.
export function PatternsCallout({ insight }: { insight: ReflectionPatternInsight | null }) {
  const navigate = useNavigate();

  if (!insight) return null;

  return (
    <div className="mb-3 mt-4">
      <SectionHeader title="Patterns this week" />
      <Card variant="inset" style={{ backgroundColor: tokens.cardSoft }}>
        <button
          type="button"
          onClick={() => navigate(insight.link)}
          className="flex items-center justify-between w-full text-left hover:opacity-90 transition-opacity gap-3"
        >
          <span style={{ fontSize: 14, color: '#1A1A1A', lineHeight: 1.2 }}>
            {insight.message}
          </span>
          <ChevronRight size={16} className="text-[#5F5E5A] flex-shrink-0" />
        </button>
      </Card>
    </div>
  );
}
