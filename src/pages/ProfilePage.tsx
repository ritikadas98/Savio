import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BottomNav } from '../components/layout/BottomNav';
import { ReviewerConsole } from '../components/profile/ReviewerConsole';

type ProfileSummary = {
  full_name: string | null;
  avatar: string | null;
  life_stage: string | null;
};

const formatLifeStage = (raw: string | null) => {
  if (!raw) return '';
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
};

const formatAvatar = (raw: string | null) => {
  if (!raw) return 'Strategist';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

export function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar, life_stage')
        .eq('auth_user_id', user.id)
        .single();
      if (!cancelled && data) setProfile(data);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#E4ECE6]">
      {/* Header with back arrow */}
      <header className="flex-shrink-0 px-5 pt-4 pb-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/home')}
          aria-label="Back to home"
          className="w-9 h-9 rounded-full flex items-center justify-center text-[#1A1A1A] hover:bg-black/[0.04] transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-semibold text-[#0C447C]">Profile</h1>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-4 space-y-4">
        {/* Identity strip — Phase 4 will expand this into a full hero. */}
        <div className="flex items-center gap-3 px-1 py-2">
          <div className="w-12 h-12 rounded-full bg-[#DCEEFF] flex items-center justify-center flex-shrink-0">
            <Compass size={24} className="text-[#0C447C]" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-[#1A1A1A] truncate">
              {profile?.full_name ?? 'Priya Sharma'}
            </h2>
            <p className="text-sm text-[#5A6B5F] truncate">
              {formatAvatar(profile?.avatar ?? 'strategist')}
              {profile?.life_stage ? ` · ${formatLifeStage(profile.life_stage)}` : ''}
            </p>
          </div>
        </div>

        <ReviewerConsole />
      </div>

      <BottomNav />
    </div>
  );
}
