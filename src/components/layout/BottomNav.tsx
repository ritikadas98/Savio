import { useNavigate, useLocation } from 'react-router-dom';
import { Home, MessageCircle, BookmarkCheck, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Tab = { id: string; label: string; path: string; icon: LucideIcon };

// Per Phase 2.9 Decision 2: 4 tabs. Profile is no longer in the nav — accessed
// via the avatar pill in the header (HomePage, ChatPage). Route still exists.
const tabs: Tab[] = [
  { id: 'home', label: 'Home', path: '/home', icon: Home },
  { id: 'chat', label: 'Chat', path: '/chat', icon: MessageCircle },
  { id: 'reflect', label: 'Reflect', path: '/reflect', icon: BookmarkCheck },
  { id: 'goals', label: 'Goals', path: '/goals', icon: Target },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex-shrink-0 bg-[#E4ECE6] border-t border-black/5 px-3 z-50">
      <div className="flex justify-between items-center py-1.5">
        {tabs.map(tab => {
          const isActive = location.pathname === tab.path || location.pathname.startsWith(tab.path + '/');
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-2xl transition-colors ${isActive ? 'bg-[#DCEEFF] text-[#0C447C]' : 'text-secondary hover:bg-black/5'}`}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={20} strokeWidth={2} />
              <span className="text-[11px] font-medium leading-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
