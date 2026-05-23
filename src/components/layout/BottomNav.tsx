import { useNavigate, useLocation } from 'react-router-dom';

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: 'home', label: 'Home', path: '/home' },
    { id: 'chat', label: 'Chat', path: '/chat' },
    { id: 'reflect', label: 'Reflect', path: '/reflect' },
    { id: 'goals', label: 'Goals', path: '/goals' },
    { id: 'profile', label: 'Profile', path: '/profile' }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#E4ECE6] border-t border-black/5 pb-safe pt-2 px-4 z-50">
      <div className="flex justify-between items-center max-w-md mx-auto h-16">
        {tabs.map(tab => {
          const isActive = location.pathname.startsWith(tab.path);
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center w-16 h-12 rounded-full transition-colors ${isActive ? 'bg-[#DCEEFF] text-[#0C447C]' : 'text-secondary hover:bg-black/5'}`}
            >
              <span className="text-caption font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
