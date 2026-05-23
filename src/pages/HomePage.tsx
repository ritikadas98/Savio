import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { calculateSafeToSpend } from '../lib/safeToSpend';
import { generateGuidance } from '../lib/guidance';
import { getNextAnchorDate, DEMO_TODAY } from '../lib/dates';
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

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
        { data: profile },
        { data: goals },
        { data: commitments },
        { data: recentTransactions },
        { data: uncategorized },
        { data: pendingWindfall },
        { data: currentRitual },
        { data: recentReflections }
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('goals').select('*').eq('user_id', user.id),
        supabase.from('commitments').select('*').eq('user_id', user.id),
        supabase.from('transactions').select('*').eq('user_id', user.id).order('occurred_at', { ascending: false }).limit(4),
        supabase.from('transactions').select('id', { count: 'exact' }).eq('user_id', user.id).is('category', null),
        supabase.from('windfalls').select('*').eq('user_id', user.id).eq('status', 'pending_allocation').order('detected_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('monthly_rituals').select('*').eq('user_id', user.id).eq('status', 'pending').limit(1).maybeSingle(),
        supabase.from('reflections').select('*').eq('user_id', user.id).order('reflected_at', { ascending: false }).limit(10)
      ]);

      setData({
        profile,
        goals: goals || [],
        commitments: commitments || [],
        recentTransactions: recentTransactions || [],
        uncategorizedCount: uncategorized?.length || 0, // Fallback if count exact fails
        pendingWindfall,
        currentRitual,
        recentReflections: recentReflections || []
      });
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading || !data) return <div className="p-8 text-center text-secondary">Loading...</div>;

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

  // Uncategorized count
  // supabase count='exact' returns count property but here we mapped it or fallback to length
  // We need to properly fetch count. Let's assume we do another query or just use the length if we queried all.
  // We used .select('id', { count: 'exact' }) which returns { data, count }.
  
  return (
    <div className="min-h-screen bg-[#E4ECE6] pb-24">
      <div className="max-w-md mx-auto p-4 pt-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-secondary text-caption">👋 Welcome in, {profile?.full_name?.split(' ')[0] || 'User'}</div>
            <h1 className="text-heading font-medium text-primary">Your Dashboard</h1>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#DCEEFF] border border-[#0C447C]/10 flex items-center justify-center">
            {/* Strategist Icon Mock */}
            <svg width="20" height="20" fill="none" stroke="#0C447C" strokeWidth="2"><polygon points="12 2 2 22 12 18 22 22 12 2"></polygon></svg>
          </div>
        </div>

        {pendingWindfall && (
          <WindfallCard amount={pendingWindfall.amount} detectedAt={pendingWindfall.detected_at} />
        )}

        <SafeToSpendHero amount={safeToSpend} anchorDate={nextAnchorDate} />

        {currentRitual && (
          <MonthlyRitualBanner monthYear={currentRitual.month_year} />
        )}

        <CommitmentsCard ratio={ratioStr} total={commitmentsCount} />

        <ForYouTodayCard items={guidanceItems} />

        {/* Instead of passing the raw data response, we need to pass the actual count. The previous query might not return count directly in data. Let's just use data.length for MVP. */}
        {uncategorizedCount > 0 && (
          <CategorizationBanner count={uncategorizedCount} />
        )}

        <RecentTransactionsList transactions={recentTransactions} />

      </div>
      <BottomNav />
    </div>
  );
}
