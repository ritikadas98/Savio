import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Target, Shield, CalendarPlus, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatMonthName } from '../../lib/dates';
import { Card } from '../primitives';
import type { CloseOutData } from './MonthlyRitualCloseOut';

type ActiveGoal = {
  id: string;
  label: string;
  current_amount: number;
  target_amount: number;
  monthly_contribution: number | null;
};

type Destination =
  | { kind: 'goal';           goal: ActiveGoal }
  | { kind: 'emergency_fund'; goal: ActiveGoal }
  | { kind: 'carry_forward' };

const formatINRInt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.abs(n));

export function MonthlyRitualRollover() {
  const { month = '2026-04' } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState<CloseOutData | null>(null);
  const [goals, setGoals] = useState<ActiveGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Destination | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      // Re-fetch close-out + active goals in parallel.
      const [closeOutRes, goalsRes] = await Promise.all([
        supabase.functions.invoke('ritual-close-out', { body: { month } }),
        (async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return { data: null, error: new Error('not authed') };
          const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user.id).single();
          if (!profile) return { data: null, error: new Error('no profile') };
          return supabase
            .from('goals')
            .select('id, label, current_amount, target_amount, monthly_contribution')
            .eq('user_id', profile.id)
            .eq('status', 'active');
        })(),
      ]);
      if (cancelled) return;
      if (closeOutRes.error || closeOutRes.data?.error) {
        setError(closeOutRes.error?.message ?? closeOutRes.data?.error ?? 'Could not load');
        setLoading(false);
        return;
      }
      const closeOut = closeOutRes.data as CloseOutData;
      if (closeOut.total_leftover <= 0) {
        // No leftover to roll — redirect to complete (negative branch closeout)
        navigate(`/ritual/${month}/complete`, { replace: true });
        return;
      }
      setData(closeOut);
      setGoals((goalsRes.data as ActiveGoal[]) ?? []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [month, navigate]);

  const handleConfirm = async () => {
    if (!data || !selected || submitting) return;
    setSubmitting(true);
    try {
      const args = {
        p_month_year: data.month,
        p_skip_rollover: false,
        p_source_breakdown: {
          discretionary_leftover: data.discretionary_leftover,
          commitment_buffers: data.commitment_buffers,
          commitment_overruns: data.commitment_overruns,
        },
        p_total_amount: data.total_leftover,
        p_destination_kind: selected.kind,
        p_destination_goal_id: selected.kind === 'carry_forward' ? null : selected.goal.id,
        p_close_out_snapshot: data,
      };
      const { error: rpcErr } = await supabase.rpc('complete_monthly_ritual', args);
      if (rpcErr) throw rpcErr;
      navigate(`/ritual/${data.month}/complete`, {
        state: {
          total_amount: data.total_leftover,
          destination_kind: selected.kind,
          destination_label: selected.kind === 'carry_forward'
            ? 'next month'
            : selected.goal.label,
        },
      });
    } catch (err) {
      console.error('[Rollover] RPC failed:', err);
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[#E4ECE6] items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0C447C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col h-full bg-[#E4ECE6] items-center justify-center p-6 text-center">
        <p className="font-medium text-[#1A1A1A] mb-2">Could not load rollover</p>
        <p className="text-sm text-[#5A6B5F] mb-4">{error ?? 'Unknown error'}</p>
        <button type="button" onClick={() => navigate('/home')} className="px-4 py-2 rounded-full bg-[#0C447C] text-white text-sm font-medium">
          Back to home
        </button>
      </div>
    );
  }

  const monthName = formatMonthName(data.month);
  const emergencyFund = goals.find(g => g.label.toLowerCase().includes('emergency'));
  const otherGoals = goals.filter(g => g !== emergencyFund);

  const isSelected = (d: Destination): boolean => {
    if (!selected) return false;
    if (selected.kind !== d.kind) return false;
    if (selected.kind === 'carry_forward') return d.kind === 'carry_forward';
    return d.kind !== 'carry_forward' && selected.goal.id === d.goal.id;
  };

  return (
    <div className="flex flex-col h-full bg-[#E4ECE6]">
      <header className="flex-shrink-0 px-5 pt-4 pb-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(`/ritual/${data.month}`)}
          aria-label="Back to close-out summary"
          className="w-9 h-9 rounded-full flex items-center justify-center text-[#1A1A1A] hover:bg-black/[0.04] transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-[#5A6B5F]">Where should it go?</div>
          <h1 className="text-xl font-semibold text-[#0C447C] truncate">
            {monthName}&rsquo;s {formatINRInt(data.total_leftover)}
          </h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-4 space-y-3">
        <div className="text-sm text-[#5A6B5F] px-1 pb-1">
          Pick one destination. You can&rsquo;t change this after confirming.
        </div>

        {/* Active goals (excluding Emergency) */}
        {otherGoals.map(g => {
          const dest: Destination = { kind: 'goal', goal: g };
          const target = Number(g.target_amount);
          const currentAfter = Number(g.current_amount) + data.total_leftover;
          const pctAfter = target > 0 ? Math.min((currentAfter / target) * 100, 100) : 0;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelected(dest)}
              aria-pressed={isSelected(dest)}
              className={`block w-full text-left transition-colors ${isSelected(dest) ? 'ring-2 ring-[#0C447C] rounded-[24px]' : ''}`}
            >
              <Card accentColor={isSelected(dest) ? 'green' : undefined} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#DEF2CB] flex items-center justify-center flex-shrink-0">
                  <Target size={18} className="text-[#3B6D11]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#0C447C] truncate">{g.label}</div>
                  <div className="text-xs text-[#5A6B5F] mt-0.5">
                    {formatINRInt(Number(g.current_amount))} of {formatINRInt(target)} · {pctAfter.toFixed(0)}% after rollover
                  </div>
                </div>
                {isSelected(dest) && <Check size={20} className="text-[#3B6D11] flex-shrink-0" />}
              </Card>
            </button>
          );
        })}

        {/* Emergency fund (special destination_kind) */}
        {emergencyFund && (() => {
          const dest: Destination = { kind: 'emergency_fund', goal: emergencyFund };
          return (
            <button
              type="button"
              onClick={() => setSelected(dest)}
              aria-pressed={isSelected(dest)}
              className={`block w-full text-left transition-colors ${isSelected(dest) ? 'ring-2 ring-[#0C447C] rounded-[24px]' : ''}`}
            >
              <Card accentColor={isSelected(dest) ? 'blue' : undefined} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#DCEEFF] flex items-center justify-center flex-shrink-0">
                  <Shield size={18} className="text-[#0C447C]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#0C447C] truncate">{emergencyFund.label}</div>
                  <div className="text-xs text-[#5A6B5F] mt-0.5">
                    Safety net. {formatINRInt(Number(emergencyFund.current_amount))} of {formatINRInt(Number(emergencyFund.target_amount))}
                  </div>
                </div>
                {isSelected(dest) && <Check size={20} className="text-[#0C447C] flex-shrink-0" />}
              </Card>
            </button>
          );
        })()}

        {/* Carry forward */}
        {(() => {
          const dest: Destination = { kind: 'carry_forward' };
          return (
            <button
              type="button"
              onClick={() => setSelected(dest)}
              aria-pressed={isSelected(dest)}
              className={`block w-full text-left transition-colors ${isSelected(dest) ? 'ring-2 ring-[#0C447C] rounded-[24px]' : ''}`}
            >
              <Card className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FCF1CC] flex items-center justify-center flex-shrink-0">
                  <CalendarPlus size={18} className="text-[#854F0B]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#0C447C] truncate">Carry forward to next month</div>
                  <div className="text-xs text-[#5A6B5F] mt-0.5">
                    Adds to next month&rsquo;s safe-to-spend.
                  </div>
                </div>
                {isSelected(dest) && <Check size={20} className="text-[#0C447C] flex-shrink-0" />}
              </Card>
            </button>
          );
        })()}

        {/* Confirm */}
        <div className="pt-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selected || submitting}
            className="w-full px-5 py-3 rounded-full bg-[#0C447C] text-white text-base font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : `Confirm — ${formatINRInt(data.total_leftover)} to ${selected
              ? (selected.kind === 'carry_forward' ? 'next month' : selected.goal.label)
              : '…'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
