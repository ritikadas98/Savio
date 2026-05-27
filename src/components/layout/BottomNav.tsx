import { useNavigate, useLocation } from 'react-router-dom';
import { Home, MessageCircle, Sparkles, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Tab = { id: string; label: string; path: string; icon: LucideIcon };

// Stream 0D: BottomNav active state per master plan §2.1 #7 + JSX preview
// lines 1380-1417. No plate behind the active icon — restraint pattern.
// Active = T.avStop (#0C447C navy) + stroke 2.4 + font 500.
// Inactive = T.t (#888780 tertiary grey) + stroke 1.8 + font 400.
// This is the "navy reserved for avatar identity" exception (master plan §2.1 #3).
//
// Reflect tab uses Sparkles per JSX preview line 1384 (not BookmarkCheck).
const tabs: Tab[] = [
  { id: 'home', label: 'Home', path: '/home', icon: Home },
  { id: 'chat', label: 'Chat', path: '/chat', icon: MessageCircle },
  { id: 'reflect', label: 'Reflect', path: '/reflect', icon: Sparkles },
  { id: 'goals', label: 'Goals', path: '/goals', icon: Target },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div
      className="flex-shrink-0 z-50"
      style={{
        borderTop: '0.5px solid rgba(0,0,0,0.07)',
        backgroundColor: '#E4ECE6',
        paddingBottom: 14,
      }}
    >
      <div className="flex" style={{ padding: '10px 8px 6px' }}>
        {tabs.map(tab => {
          const isActive = location.pathname === tab.path || location.pathname.startsWith(tab.path + '/');
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate(tab.path)}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
              className="flex flex-col items-center justify-center transition-colors"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                gap: 4,
                padding: '6px 4px',
                cursor: 'pointer',
                color: isActive ? '#0C447C' : '#888780',
                fontFamily: 'inherit',
              }}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
              <span style={{ fontSize: 10.5, fontWeight: isActive ? 500 : 400, lineHeight: 1.2 }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
