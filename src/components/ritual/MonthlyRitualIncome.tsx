import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Card } from '../primitives';
import { Snackbar } from '../profile/Snackbar';
import { formatRupeesIndian, formatDateLong } from '../../lib/formatters';
import { getNextMonthName } from '../../lib/dates';
import { DEMO_MODE_MESSAGE } from '../../lib/copy';
import { RitualHeader, RitualTitle, RitualPrimaryButton, ArrowRight } from './RitualPrimitives';

// Phase C1 Screen 4: confirm the new month's salary credit. The route param
// `:month` is M-1 (April) — consistent with the rest of the ritual flow —
// and the new month (May) is derived. The salary transaction shown is the
// first credit in the new month.

type SalaryTx = {
  amount: number;
  occurred_at: string;
  merchant: string | null;
};

function nextMonthYear(monthYear: string): string {
  const [yearStr, monthStr] = monthYear.split('-');
  const y = Number(yearStr);
  const m = Number(monthStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthYear;
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  return `${nextY}-${String(nextM).padStart(2, '0')}`;
}

export function MonthlyRitualIncome() {
  const { month = '2026-04' } = useParams();
  const navigate = useNavigate();
  const newMonth = nextMonthYear(month);
  const newMonthName = getNextMonthName(month);

  const [salaryTx, setSalaryTx] = useState<SalaryTx | null>(null);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<'no_other' | 'has_other' | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();
      if (!profile) { setLoading(false); return; }

      const [yearStr, monthStr] = newMonth.split('-');
      const startIso = `${yearStr}-${monthStr}-01`;
      const endIso = `${nextMonthYear(newMonth)}-01`;

      const { data } = await supabase
        .from('transactions')
        .select('amount, occurred_at, merchant')
        .eq('user_id', profile.id)
        .eq('direction', 'credit')
        .eq('category', 'Income')
        .gte('occurred_at', startIso)
        .lt('occurred_at', endIso)
        .order('amount', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      setSalaryTx(data as SalaryTx | null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [newMonth]);

  return (
    <div className="flex flex-col h-full bg-[#E4ECE6]">
      <RitualHeader stepLabel="4 of 7" onClose={() => navigate('/home')} />
      <RitualTitle sub="We saw your salary land this morning.">
        Income for {newMonthName}
      </RitualTitle>

      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ padding: '0 16px 24px' }}>
        {loading ? (
          <div className="flex justify-center" style={{ padding: '24px 0' }}>
            <div className="w-6 h-6 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !salaryTx ? (
          <Card>
            <div style={{ fontSize: 14, color: '#1A1A1A' }}>No salary credit found for {newMonthName}.</div>
            <div style={{ fontSize: 12.5, color: '#5F5E5A', marginTop: 4 }}>You can still continue — Savio will catch up when it lands.</div>
          </Card>
        ) : (
          <Card variant="hero">
            <div style={{ fontSize: 12.5, color: '#5F5E5A', marginBottom: 6 }}>Salary credited</div>
            <div
              style={{
                fontSize: 44,
                fontWeight: 500,
                color: '#1A1A1A',
                letterSpacing: '-1px',
                lineHeight: 1,
                marginBottom: 8,
              }}
            >
              {formatRupeesIndian(Number(salaryTx.amount))}
            </div>
            <div style={{ fontSize: 12, color: '#888780' }}>
              {formatDateLong(salaryTx.occurred_at)} · {salaryTx.merchant ?? 'Unknown'}
            </div>
          </Card>
        )}

        <div style={{ marginTop: 18, fontSize: 13.5, color: '#5F5E5A', padding: '0 6px' }}>
          Did you receive any other income this month?
        </div>
        <div className="flex" style={{ gap: 8, marginTop: 10 }}>
          <button
            type="button"
            onClick={() => setChoice('no_other')}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 14,
              backgroundColor: '#FFFFFF',
              color: '#1A1A1A',
              border: choice === 'no_other' ? '1px solid #0C447C' : '0.5px solid rgba(0,0,0,0.07)',
              fontSize: 13.5,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            No, just salary
          </button>
          <button
            type="button"
            onClick={() => {
              setChoice('has_other');
              setSnack(DEMO_MODE_MESSAGE);
            }}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 14,
              backgroundColor: '#FFFFFF',
              color: '#1A1A1A',
              border: choice === 'has_other' ? '1px solid #0C447C' : '0.5px solid rgba(0,0,0,0.07)',
              fontSize: 13.5,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Yes, let me add
          </button>
        </div>

        <div style={{ marginTop: 24 }}>
          <RitualPrimaryButton
            onClick={() => navigate(`/ritual/${month}/commitments`)}
            disabled={choice === null}
          >
            Continue <ArrowRight size={16} />
          </RitualPrimaryButton>
        </div>
      </div>

      <Snackbar message={snack} onDismiss={() => setSnack(null)} />
    </div>
  );
}
