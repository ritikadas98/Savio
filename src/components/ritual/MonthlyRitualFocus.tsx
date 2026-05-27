import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { inrCompact } from '../../lib/formatters';
import { formatGoalDueDate } from '../../lib/dates';
import { RitualHeader, RitualTitle, RitualPrimaryButton, ArrowRight } from './RitualPrimitives';

// Phase C1 Screen 6: focus-goal selection. 3 active goals + "No specific
// focus" virtual option = 4 options. Selection is required (Continue
// disabled until tap). On Continue, focusGoalId passes to Lock-in via
// location.state.

type GoalRow = {
  id: string;
  label: string;
  current_amount: number;
  target_amount: number;
  target_date: string | null;
};

const NO_FOCUS_ID = 'none';

export function MonthlyRitualFocus() {
  const { month = '2026-04' } = useParams();
  const navigate = useNavigate();

  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

      const { data } = await supabase
        .from('goals')
        .select('id, label, current_amount, target_amount, target_date')
        .eq('user_id', profile.id)
        .eq('status', 'active')
        .order('priority', { ascending: true });

      if (cancelled) return;
      setGoals((data ?? []) as GoalRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const options = [
    ...goals.map(g => ({
      id: g.id,
      label: g.label,
      sub: `${inrCompact(Number(g.current_amount))} of ${inrCompact(Number(g.target_amount))} · ${formatGoalDueDate(g.target_date)}`,
    })),
    { id: NO_FOCUS_ID, label: 'No specific focus', sub: 'Just stay aware' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#E4ECE6]">
      <RitualHeader stepLabel="6 of 7" onClose={() => navigate('/home')} />
      <RitualTitle sub="Pick one. You can change it any time this month.">
        Your focus this month
      </RitualTitle>

      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ padding: '0 16px 24px' }}>
        {loading ? (
          <div className="flex justify-center" style={{ padding: '24px 0' }}>
            <div className="w-6 h-6 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex flex-col" style={{ gap: 8 }}>
              {options.map(opt => {
                const active = selectedId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedId(opt.id)}
                    className="hover:bg-black/[0.02] transition-colors"
                    style={{
                      textAlign: 'left',
                      padding: '14px 16px',
                      backgroundColor: '#FFFFFF',
                      border: active ? '1.5px solid #0C447C' : '0.5px solid rgba(0,0,0,0.07)',
                      borderRadius: 18,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        border: `1.5px solid ${active ? '#0C447C' : 'rgba(0,0,0,0.14)'}`,
                        backgroundColor: active ? '#0C447C' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {active && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14.5, color: '#1A1A1A', fontWeight: 500 }}>{opt.label}</div>
                      <div style={{ fontSize: 11.5, color: '#888780', marginTop: 2 }}>{opt.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 24 }}>
              <RitualPrimaryButton
                onClick={() => {
                  // null in URL state means "No specific focus" downstream
                  const focusGoalId = selectedId === NO_FOCUS_ID ? null : selectedId;
                  navigate(`/ritual/${month}/lockin`, { state: { focusGoalId } });
                }}
                disabled={selectedId === null}
              >
                Continue <ArrowRight size={16} />
              </RitualPrimaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
