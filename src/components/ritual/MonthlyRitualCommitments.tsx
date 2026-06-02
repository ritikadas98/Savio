import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Card } from '../primitives';
import { Snackbar } from '../profile/Snackbar';
import { formatRupeesIndian } from '../../lib/formatters';
import { DEMO_MODE_MESSAGE } from '../../lib/copy';
import { RitualHeader, RitualTitle, RitualPrimaryButton, ArrowRight } from './RitualPrimitives';

// Phase C1 Screen 5: read-only scan of fixed commitments with "Same" pills.
// Real seed has 13 individual fixed commitments totaling ₹62,468 (JSX
// preview's hardcoded 6-grouped ₹61,468 was design-time approximation;
// per Phase B3 / B2 precedent we render real data and surface the gap).
//
// Per [PRESENTATIONAL] discipline + Stream 0.5i: tap any row → snackbar
// uses DEMO_MODE_MESSAGE constant. No actual editing in MVP.

type CommitmentRow = {
  id: string;
  label: string;
  amount: number;
};

export function MonthlyRitualCommitments() {
  const { month = '2026-04' } = useParams();
  const navigate = useNavigate();

  const [commitments, setCommitments] = useState<CommitmentRow[]>([]);
  const [income, setIncome] = useState<number>(0);
  const [loading, setLoading] = useState(true);
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

      const { data } = await supabase
        .from('commitments')
        .select('id, label, amount, due_day_of_month')
        .eq('user_id', profile.id)
        .eq('kind', 'fixed')
        .order('due_day_of_month', { ascending: true, nullsFirst: false });

      if (cancelled) return;
      setCommitments((data ?? []) as CommitmentRow[]);
      setIncome(Number(profile.monthly_income_net ?? 0));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const total = commitments.reduce((s, c) => s + Number(c.amount), 0);
  const slack = Math.max(0, income - total);

  return (
    <div className="flex flex-col h-full bg-[#E4ECE6]">
      <RitualHeader stepLabel="5 of 7" onClose={() => navigate('/home')} />
      {/* D.57 (Stream 0.5u piece #1) — title aligned with the
          "Fixed commitments" sweep across Home + Profile + chat
          grounding. This surface lists kind='fixed' rows only
          (see line 46 query); the label now matches the data. */}
      <RitualTitle sub="A quick scan of what's committed. Tap to adjust any that changed.">
        Your fixed commitments
      </RitualTitle>

      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ padding: '0 16px 24px' }}>
        {loading ? (
          <div className="flex justify-center" style={{ padding: '24px 0' }}>
            <div className="w-6 h-6 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <Card style={{ padding: 0 }}>
              {commitments.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSnack(DEMO_MODE_MESSAGE)}
                  className="hover:bg-black/[0.02] transition-colors"
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '13px 14px',
                    borderBottom:
                      i < commitments.length - 1 ? '0.5px solid rgba(0,0,0,0.07)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 13.5, color: '#1A1A1A' }}>{c.label}</span>
                  <div className="flex items-center" style={{ gap: 6 }}>
                    <span style={{ fontSize: 13.5, color: '#1A1A1A', fontWeight: 500 }}>
                      {formatRupeesIndian(Number(c.amount))}
                    </span>
                    <span style={{ fontSize: 11.5, color: '#0C447C' }}>Same</span>
                  </div>
                </button>
              ))}
            </Card>

            <div
              style={{
                marginTop: 14,
                padding: '10px 14px',
                borderRadius: 14,
                backgroundColor: '#FAFAF7',
                fontSize: 12.5,
                color: '#5F5E5A',
                lineHeight: 1.5,
              }}
            >
              Total: <strong style={{ color: '#1A1A1A' }}>{formatRupeesIndian(total)}/month</strong>.
              This leaves <strong style={{ color: '#1A1A1A' }}>{formatRupeesIndian(slack)}</strong> as base monthly slack before goals.
            </div>

            <div style={{ marginTop: 24 }}>
              <RitualPrimaryButton onClick={() => navigate(`/ritual/${month}/focus`)}>
                Looks right <ArrowRight size={16} />
              </RitualPrimaryButton>
            </div>
          </>
        )}
      </div>

      <Snackbar message={snack} onDismiss={() => setSnack(null)} />
    </div>
  );
}
