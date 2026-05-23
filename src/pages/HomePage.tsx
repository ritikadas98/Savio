import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { calculateSafeToSpend } from '../lib/safeToSpend';
import { generateGuidance } from '../lib/guidance';
import { getNextAnchorDate } from '../lib/dates';
import { BottomNav } from '../components/layout/BottomNav';
import { SafeToSpendHero } from '../components/home/SafeToSpendHero';
import { WindfallCard } from '../components/home/WindfallCard';
import { MonthlyRitualBanner } from '../components/home/MonthlyRitualBanner';
import { CommitmentsCard } from '../components/home/CommitmentsCard';
import { RecentTransactionsList } from '../components/home/RecentTransactionsList';
import { ForYouTodayCard } from '../components/home/ForYouTodayCard';
import { CategorizationBanner } from '../components/home/CategorizationBanner';

export function HomePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      // Get the auth user's UUID
      const { data: { session } } = await supabase.auth.getSession();
      const authUid = session?.user?.id;
      if (!authUid) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('HomePage: No authenticated user found');
          setError('Not authenticated');
          setLoading(false);
          return;
        }
        return doFetch(user.id);
      }
      return doFetch(authUid);
    }

    async function doFetch(authUid: string) {
      try {
        // Step 1: Fetch profile by auth_user_id (NOT by id).
        // profiles.id is a hardcoded app-level UUID (e.g. 00000000-0000-4000-a000-000000000001).
        // profiles.auth_user_id is the real auth.users.id.
        // All child tables reference profiles.id via their user_id column.
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('auth_user_id', authUid)
          .single();

        if (profileErr || !profile) {
          console.error('Profile fetch error:', profileErr);
          if (!cancelled) {
            setError('Could not load profile');
            setLoading(false);
          }
          return;
        }

        // Step 2: Use profile.id (the app-level UUID) for all child table queries.
        // This matches the FK relationship: child.user_id -> profiles.id
        const profileId = profile.id;

        const [
          { data: goals },
          { data: commitments },
          { data: recentTransactions },
          { count: uncategorizedCount },
          { data: pendingWindfall },
          { data: currentRitual },
          { data: recentReflections }
        ] = await Promise.all([
          supabase.from('goals').select('*').eq('user_id', profileId),
          supabase.from('commitments').select('*').eq('user_id', profileId),
          supabase.from('transactions').select('*').eq('user_id', profileId).order('occurred_at', { ascending: false }).limit(4),
          supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('user_id', profileId).is('category', null),
          supabase.from('windfalls').select('*').eq('user_id', profileId).eq('status', 'pending_allocation').order('detected_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('monthly_rituals').select('*').eq('user_id', profileId).eq('status', 'pending').limit(1).maybeSingle(),
          supabase.from('reflections').select('*').eq('user_id', profileId).order('reflected_at', { ascending: false }).limit(10)
        ]);

        if (!cancelled) {
          setData({
            profile,
            goals: goals || [],
            commitments: commitments || [],
            recentTransactions: recentTransactions || [],
            uncategorizedCount: uncategorizedCount || 0,
            pendingWindfall,
            currentRitual,
            recentReflections: recentReflections || []
          });
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Failed to load home data:', err);
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[#E4ECE6] items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0C447C] border-t-transparent rounded-full animate-spin" />
        <p className="text-secondary text-caption mt-3">Loading your dashboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col h-full bg-[#E4ECE6] items-center justify-center p-6 text-center">
        <p className="text-primary font-medium mb-2">Could not load dashboard</p>
        <p className="text-secondary text-caption">{error || 'Unknown error'}</p>
        <BottomNav />
      </div>
    );
  }

  const { profile, goals, commitments, recentTransactions, uncategorizedCount, pendingWindfall, currentRitual, recentReflections } = data;

  // Safe to spend
  let safeToSpend = 0;
  if (currentRitual && currentRitual.safe_to_spend_locked) {
    safeToSpend = currentRitual.safe_to_spend_locked;
  } else {
    safeToSpend = calculateSafeToSpend(profile?.monthly_income_net || 0, commitments, goals);
  }

  const nextAnchorDate = getNextAnchorDate(profile?.anchor_day_of_month || 1);

  // Commitments ratio
  const commitmentsCount = commitments.length;
  const ratioStr = `${commitmentsCount}/${commitmentsCount}`;

  // Guidance
  const guidanceItems = generateGuidance({ activeGoals: goals, recentReflections });

  // Avatar icon
  const avatarName = (profile?.avatar || 'strategist').toLowerCase();
  const avatarConfig: Record<string, { bg: string; stroke: string }> = {
    strategist: { bg: '#DCEEFF', stroke: '#0C447C' },
    adventurer: { bg: '#FCF1CC', stroke: '#854F0B' },
    builder: { bg: '#DEF2CB', stroke: '#3B6D11' },
  };
  const av = avatarConfig[avatarName] || avatarConfig.strategist;

  return (
    <div className="flex flex-col h-full bg-[#E4ECE6]">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pt-10 pb-4">

          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-secondary text-caption">👋 Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}</div>
              <h1 className="text-heading font-medium text-primary">Your Dashboard</h1>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center border"
                 style={{ backgroundColor: av.bg, borderColor: av.stroke + '1A' }}>
              <svg width="20" height="20" fill="none" stroke={av.stroke} strokeWidth="2">
                <polygon points="12 2 2 22 12 18 22 22 12 2"></polygon>
              </svg>
            </div>
          </div>

          {pendingWindfall && (
            <WindfallCard amount={pendingWindfall.amount} source={pendingWindfall.source || 'Unexpected deposit'} detectedAt={pendingWindfall.detected_at} />
          )}

          <SafeToSpendHero amount={safeToSpend} anchorDate={nextAnchorDate} />

          {currentRitual && (
            <MonthlyRitualBanner monthYear={currentRitual.month_year} />
          )}

          <CommitmentsCard ratio={ratioStr} total={commitmentsCount} />

          <ForYouTodayCard items={guidanceItems} />

          {uncategorizedCount > 0 && (
            <CategorizationBanner count={uncategorizedCount} />
          )}

          <RecentTransactionsList transactions={recentTransactions} />

        </div>
      </div>

      <BottomNav />
    </div>
  );
}
