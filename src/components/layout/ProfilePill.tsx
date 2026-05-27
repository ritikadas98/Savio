import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Sailboat, Hammer, type LucideIcon } from 'lucide-react';

// Stream 0G: top-bar avatar plate per master plan §3.3 (Behance-aligned):
//   40×40 white rounded-square (radius 14), avatar icon T.avStop, size 18,
//   strokeWidth 2. Navy stays the avatar identity color — that's the
//   "navy reserved for avatar identity" exception (§2.1 #3).
//
// Phase C4 — reads localStorage['savio_demo_avatar'] (written by the
// onboarding flow on Continue from Step 5). Falls back to Strategist /
// Compass when absent — that's also the skip-path default. Chat behavior
// stays Strategist for Priya regardless of the icon shown here per
// PM_DECISIONS.C.18 (visual completeness, behavioral V2).

const AVATAR_ICONS: Record<string, LucideIcon> = {
  strategist: Compass,
  adventurer: Sailboat,
  builder: Hammer,
};

export function ProfilePill({ avatar: _avatar }: { avatar?: string | null }) {
  const navigate = useNavigate();
  const [icon, setIcon] = useState<LucideIcon>(Compass);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('savio_demo_avatar') : null;
      if (stored && AVATAR_ICONS[stored]) {
        setIcon(() => AVATAR_ICONS[stored]);
      }
    } catch {
      // private browsing or SSR — default Compass already set.
    }
  }, []);

  const Icon = icon;
  return (
    <button
      type="button"
      onClick={() => navigate('/profile')}
      aria-label="Open profile"
      className="flex-shrink-0 flex items-center justify-center transition-opacity hover:opacity-80"
      style={{
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        border: '0.5px solid rgba(0,0,0,0.07)',
        color: '#0C447C',
      }}
    >
      <Icon size={18} strokeWidth={2} />
    </button>
  );
}
