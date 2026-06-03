import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card } from '../primitives';
import { Snackbar } from '../profile/Snackbar';
import { formatRupeesIndian } from '../../lib/formatters';
import { getNextMonthName, defaultPendingMonth } from '../../lib/dates';
import { calculateSafeToSpend } from '../../lib/safeToSpend';
import { RitualHeader, RitualTitle, RitualPrimaryButton } from './RitualPrimitives';

// Phase C1 Screen 7: lock-in. Computes the new month's safe-to-spend via
// the canonical calculateSafeToSpend (same formula home + chat use), then
// writes to monthly_rituals via complete_monthly_setup RPC.
//
// Diverges from spec Section 2.5 formula (income - all commitments -
// focus_contribution + rollover_carry) — uses calculateSafeToSpend instead
// to keep all three SPS-displaying surfaces consistent (₹12,032 across
// home / chat / lock-in for Priya). Surfaced in report.

type LocationState = {
  focusGoalId?: string | null;
} | null;

function nextMonthYear(monthYear: string): string {
  const [yearStr, monthStr] = monthYear.split('-');
  const y = Number(yearStr);
  const m = Number(monthStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthYear;
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  return `${nextY}-${String(nextM).padStart(2, '0')}`;
}

function daysInMonth(monthYear: string): number {
  const [yearStr, monthStr] = monthYear.split('-');
  const y = Number(yearStr);
  const m = Number(monthStr);
  return new Date(y, m, 0).getDate();
}

export function MonthlyRitualLockIn() {
  const { month: rawMonth } = useParams();
  const month = rawMonth ?? defaultPendingMonth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) ?? null;
  const focusGoalId = state?.focusGoalId ?? null;

  const newMonth = nextMonthYear(month);
  const newMonthName = getNextMonthName(month);
  const followingMonthName = getNextMonthName(newMonth);
  const dim = daysInMonth(newMonth);

  // D.65 follow-up (Spec 2.1) — base STS gets WRITTEN to
  // safe_to_spend_locked; the user-facing number on this lock-in screen
  // adds carry-forward on top. Single home for carry-forward is the
  // read path (Home + chat both do `locked + cf` already), matching the
  // "don't cache derived values" invariant.
  const [baseSts, setBaseSts] = useState<number | null>(null);
  const [carryForward, setCarryForward] = useState<number>(0);
  const safeToSpend = baseSts != null ? baseSts + carryForward : null;
  const [income, setIncome] = useState<number>(0);
  const [focusGoalLabel, setFocusGoalLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, monthly_income_net')
        .eq('auth_user_id', user.id)
        .single();
      if (!profile) { setLoading(false); return; }

      // Fetch what calculateSafeToSpend needs
      const [{ data: commitments }, { data: goals }, { data: cfRows }, focusGoalRes] = await Promise.all([
        supabase.from('commitments').select('amount, category, kind').eq('user_id', profile.id),
        supabase.from('goals').select('monthly_contribution, status').eq('user_id', profile.id),
        supabase.from('rollover_allocations').select('total_amount').eq('user_id', profile.id)
          .eq('ritual_month', `${month}-01`).eq('destination_kind', 'carry_forward'),
        focusGoalId
          ? supabase.from('goals').select('label').eq('id', focusGoalId).single()
          : Promise.resolve({ data: null }),
      ]);

      const cf = (cfRows ?? []).reduce((s: number, r: { total_amount: number }) => s + Number(r.total_amount || 0), 0);
      // D.65 follow-up (Spec 2.1) — write the BASE (carryForward=0), let
      // the read path add carry-forward. Display still adds it via the
      // `safeToSpend = baseSts + carryForward` derivation above.
      const base = calculateSafeToSpend(
        Number(profile.monthly_income_net ?? 0),
        commitments ?? [],
        goals ?? [],
        0,
      );

      if (cancelled) return;
      setBaseSts(base);
      setCarryForward(cf);
      setIncome(Number(profile.monthly_income_net ?? 0));
      const fg = (focusGoalRes as { data: { label: string } | null }).data;
      setFocusGoalLabel(fg?.label ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [month, focusGoalId]);

  const handleLockIn = async () => {
    if (baseSts == null || submitting) return;
    setSubmitting(true);
    // D.65 follow-up (Spec 2.1) — write the BASE STS. The read path
    // (Home + chat-respond/prompt_builder) both add carry-forward on
    // read. Writing `safeToSpend` (= base + cf) would double-count at
    // read time.
    const { error } = await supabase.rpc('complete_monthly_setup', {
      p_month_year: newMonth,
      p_focus_goal_id: focusGoalId,
      p_safe_to_spend_locked: baseSts,
      p_confirmed_income: income,
    });
    if (error) {
      console.error('[LockIn] complete_monthly_setup failed:', error);
      setSnack('Lock-in failed. Try again.');
      setSubmitting(false);
      return;
    }
    navigate('/home');
  };

  const dailyBudget = safeToSpend != null && dim > 0 ? Math.round(safeToSpend / dim) : 0;

  return (
    <div className="flex flex-col h-full bg-[#E4ECE6]">
      <RitualHeader stepLabel="7 of 7" onClose={() => navigate('/home')} />
      <RitualTitle>Your {newMonthName} is set.</RitualTitle>

      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ padding: '0 16px 24px' }}>
        {loading || safeToSpend == null ? (
          <div className="flex justify-center" style={{ padding: '24px 0' }}>
            <div className="w-6 h-6 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <Card variant="hero">
              <div style={{ fontSize: 13, color: '#5F5E5A', marginBottom: 6 }}>
                Safe to spend in {newMonthName}
              </div>
              <div className="flex items-baseline" style={{ gap: 10, marginBottom: 18 }}>
                <span
                  style={{
                    fontSize: 52,
                    fontWeight: 500,
                    color: '#1A1A1A',
                    lineHeight: 1,
                    letterSpacing: '-1.3px',
                  }}
                >
                  {formatRupeesIndian(safeToSpend)}
                </span>
              </div>
              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background:
                    'linear-gradient(90deg, #FF8F8F 0%, #FBAA5A 25%, #F4D123 50%, #B2EF82 75%, #58B9FF 100%)',
                  marginBottom: 14,
                }}
              />
              <div style={{ fontSize: 12.5, color: '#5F5E5A', lineHeight: 1.5 }}>
                That&rsquo;s <strong style={{ color: '#1A1A1A' }}>{formatRupeesIndian(dailyBudget)}/day</strong>{' '}
                across {dim} days.
                {focusGoalLabel ? (
                  <> Your focus this month is the <strong style={{ color: '#1A1A1A' }}>{focusGoalLabel.toLowerCase()}</strong>.</>
                ) : (
                  <> You&rsquo;re staying aware this month — no specific focus.</>
                )}
              </div>
            </Card>

            <div
              style={{
                marginTop: 14,
                padding: '12px 14px',
                borderRadius: 14,
                backgroundColor: '#DCEEFF',
                fontSize: 12.5,
                color: '#0C447C',
                lineHeight: 1.5,
              }}
            >
              Savio will check in again on 1 {followingMonthName}. You can ask anything in chat anytime before that.
            </div>

            <div style={{ marginTop: 22 }}>
              <RitualPrimaryButton onClick={handleLockIn} disabled={submitting}>
                <Check size={16} strokeWidth={2.5} /> {submitting ? 'Locking in…' : 'Lock it in'}
              </RitualPrimaryButton>
            </div>
          </>
        )}
      </div>

      <Snackbar message={snack} onDismiss={() => setSnack(null)} />
    </div>
  );
}
