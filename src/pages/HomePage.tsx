import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { calculateSafeToSpend } from '../lib/safeToSpend';
import { generateGuidance } from '../lib/guidance';
import { getNextAnchorDate, getPreviousMonthFirstDate, getThisWeekRange, daysAgo, today } from '../lib/dates';
import { BottomNav } from '../components/layout/BottomNav';
import { SafeToSpendHero } from '../components/home/SafeToSpendHero';
import { WindfallCard } from '../components/home/WindfallCard';
import { MonthlyRitualBanner } from '../components/home/MonthlyRitualBanner';
import { CommitmentsCard } from '../components/home/CommitmentsCard';
import { RecentTransactionsList } from '../components/home/RecentTransactionsList';
import { ForYouTodayCard } from '../components/home/ForYouTodayCard';
import { CategorizationBanner } from '../components/home/CategorizationBanner';
import { UpcomingBillsCard } from '../components/home/UpcomingBillsCard';
import { computeUpcomingBills } from '../lib/upcoming-bills';
// D.58 (Stream 0.5u piece #4) — PatternsCallout removed from Home.
// Real-user testing flagged the "Patterns this week" section as
// non-functional/low-value. Component file kept dormant for git
// history; not imported, not rendered. Reflect tab trend cards +
// emotion chart (0.5p-0.5s) carry pattern analysis instead.
// import { PatternsCallout } from '../components/home/PatternsCallout';
import { ReflectEntryCard } from '../components/home/ReflectEntryCard';
import { ProfilePill } from '../components/layout/ProfilePill';

export function HomePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // D.55 (Stream 0.5u piece #3) — session-level windfall skip flag. The
  // underlying windfall stays pending_allocation in DB; this just hides
  // the card on Home for the rest of the session. Resets when the
  // component unmounts (navigating away + back keeps it; full reload OR
  // auto-reset D.15 clears it). Intentionally NOT persisted — Skip is
  // "not now", not "never."
  const [windfallSkipped, setWindfallSkipped] = useState(false);

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

        const prevMonth = getPreviousMonthFirstDate();
        const week = getThisWeekRange();

        const [
          { data: goals },
          { data: commitments },
          { data: recentTransactions },
          { data: pendingWindfall },
          { data: currentRitual },
          { data: recentReflections },
          { data: carryForwardRows },
          { data: weekPaidTxns },
          // D.24 (Stream 0.5p #2) — count of debit txns in the last 30d above
          // ₹1,000 floor that have NO reflection. Mirrors ReflectPage's
          // fetchUnlabeledRecent shape but returns only what's needed for the
          // home-page entry card's count display. Two queries (txns + ref ids)
          // — same idiom ReflectPage uses; subtraction client-side.
          { data: unlabeledCandidates },
          { data: reflectedTxnIds }
        ] = await Promise.all([
          supabase.from('goals').select('*').eq('user_id', profileId),
          supabase.from('commitments').select('*').eq('user_id', profileId),
          // Stream 0.5-H: debit filter — "Recent Transactions" surfaces actual
          // spending, not income credits (salary, bonus, refund).
          supabase.from('transactions').select('*').eq('user_id', profileId).eq('direction', 'debit').order('occurred_at', { ascending: false }).limit(4),
          supabase.from('windfalls').select('*').eq('user_id', profileId).eq('status', 'pending_allocation').order('detected_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('monthly_rituals').select('*').eq('user_id', profileId).eq('status', 'pending').limit(1).maybeSingle(),
          supabase.from('reflections').select('*').eq('user_id', profileId).order('reflected_at', { ascending: false }).limit(10),
          // Phase 3: rollover carry-forward from last month's ritual
          supabase.from('rollover_allocations').select('total_amount').eq('user_id', profileId).eq('ritual_month', prevMonth).eq('destination_kind', 'carry_forward'),
          // Doc 1.15: commitment-linked transactions occurring this week —
          // counted against this week's due commitments for the CommitmentsCard
          // "X paid / Y due" ratio.
          supabase.from('transactions')
            .select('commitment_id')
            .eq('user_id', profileId)
            .not('commitment_id', 'is', null)
            .gte('occurred_at', week.startDate.toISOString())
            .lt('occurred_at', week.endDate.toISOString()),
          supabase.from('transactions').select('id')
            .eq('user_id', profileId)
            .eq('direction', 'debit')
            .gt('amount', 1000)
            .gte('occurred_at', daysAgo(30).toISOString())
            .lte('occurred_at', today().toISOString()),
          supabase.from('reflections').select('transaction_id').eq('user_id', profileId),
        ]);

        const carryForwardFromLastMonth = (carryForwardRows ?? []).reduce(
          (s: number, r: any) => s + Number(r.total_amount || 0), 0,
        );

        // Compute this-week commitments + paid count for the CommitmentsCard.
        // dueThisWeek = fixed commitments with due_day_of_month inside the
        //   current 7-day window (variable budgets excluded — they're spending
        //   buckets, not scheduled debits).
        // paidThisWeek = transactions this week whose commitment_id matches
        //   one of those due commitments.
        const dueThisWeekIds = new Set(
          (commitments ?? [])
            .filter((c: any) => c.kind === 'fixed' && c.due_day_of_month != null
              && c.due_day_of_month >= week.startDay && c.due_day_of_month <= week.endDay)
            .map((c: any) => c.id),
        );
        const paidThisWeekCount = (weekPaidTxns ?? [])
          .filter((t: any) => t.commitment_id && dueThisWeekIds.has(t.commitment_id))
          .length;
        const totalThisWeek = dueThisWeekIds.size;

        // D.24 — subtract already-labeled txns to get unlabeled count
        const labeledSet = new Set((reflectedTxnIds ?? []).map((r: any) => r.transaction_id));
        const unlabeledCount = (unlabeledCandidates ?? [])
          .filter((t: any) => !labeledSet.has(t.id))
          .length;

        if (!cancelled) {
          setData({
            profile,
            goals: goals || [],
            commitments: commitments || [],
            recentTransactions: recentTransactions || [],
            pendingWindfall,
            currentRitual,
            recentReflections: recentReflections || [],
            carryForwardFromLastMonth,
            paidThisWeek: paidThisWeekCount,
            totalThisWeek,
            unlabeledCount,
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
        <div className="w-8 h-8 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin" />
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

  const { profile, goals, commitments, recentTransactions, pendingWindfall, currentRitual, recentReflections, carryForwardFromLastMonth, paidThisWeek, totalThisWeek, unlabeledCount } = data;

  // Safe to spend (includes rollover carry-forward from last month, if any)
  const safeToSpend = (currentRitual && currentRitual.safe_to_spend_locked)
    ? Number(currentRitual.safe_to_spend_locked) + Number(carryForwardFromLastMonth || 0)
    : calculateSafeToSpend(profile?.monthly_income_net || 0, commitments, goals, Number(carryForwardFromLastMonth || 0));

  const anchorDay = profile?.anchor_day_of_month || 1;
  const nextAnchorDate = getNextAnchorDate(anchorDay);

  // Guidance — split into primary focus-goal insight and secondary
  // reflection-pattern callout (Doc 1.16 Stream F).
  const guidance = generateGuidance({ activeGoals: goals, recentReflections });

  // Stream 0.5-H: upcoming bills — fixed commitments due in the next 14 days
  // sorted ascending by due day. Empty array → UpcomingBillsCard renders null.
  const upcomingBills = computeUpcomingBills(commitments);

  const firstName = profile?.full_name?.split(' ')[0] || 'User';

  return (
    <div className="flex flex-col h-full bg-[#E4ECE6]">
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-5 pt-4 pb-4">

          <header className="mb-6">
            <div className="flex items-center justify-between mb-1">
              <div style={{ fontSize: 13, color: '#888780' }}>
                <span className="mr-1">👋</span>
                Welcome in, {firstName}
              </div>
              <ProfilePill />
            </div>
            <h1
              className="mt-1"
              style={{ fontSize: 36, fontWeight: 400, color: '#1A1A1A', lineHeight: 1.2, letterSpacing: '-0.8px' }}
            >
              Your Dashboard
            </h1>
          </header>

          {pendingWindfall && !windfallSkipped && (
            <WindfallCard
              amount={pendingWindfall.amount}
              source={pendingWindfall.source || 'Unexpected deposit'}
              onAllocate={() => navigate(`/windfall/${pendingWindfall.id}/allocate`)}
              onDismiss={() => setWindfallSkipped(true)}
            />
          )}

          {/* Doc 1.15 order match: Windfall → Ritual check-in → Safe-to-spend.
              The ritual card is intentionally above the safe-to-spend hero on the
              1st-of-month surface — closing out the prior month is what unlocks
              this month's number, so it reads as the upstream action. */}
          {currentRitual && (
            <MonthlyRitualBanner
              monthYear={currentRitual.month_year}
              onStart={() => navigate(`/ritual/${currentRitual.month_year}`)}
            />
          )}

          <SafeToSpendHero amount={safeToSpend} anchorDate={nextAnchorDate} />

          {/* D.24 (Stream 0.5p #2) — Reflect entry sits between safe-to-spend
              hero and CommitmentsCard. Hidden when nothing to label. */}
          <ReflectEntryCard unlabeledCount={unlabeledCount ?? 0} />

          <CommitmentsCard paidThisWeek={paidThisWeek} totalThisWeek={totalThisWeek} />

          <CategorizationBanner />

          <UpcomingBillsCard bills={upcomingBills} />

          <ForYouTodayCard insight={guidance.focusGoal} />

          {/* D.58 (Stream 0.5u #4) — "Patterns this week" section removed. */}

          <RecentTransactionsList transactions={recentTransactions} />

        </div>
      </div>

      <BottomNav />
    </div>
  );
}
