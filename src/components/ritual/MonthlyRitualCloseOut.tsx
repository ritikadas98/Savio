import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatMonthName, getNextMonthName } from '../../lib/dates';
import { Card, Pill, SectionHeader } from '../primitives';
import { ReflectionLabelRow, type ReflectionLabel } from './ReflectionLabelRow';

type CommitmentBuffer = { commitment_id: string; commitment_name: string; budgeted: number; actual: number; buffer: number };
type CommitmentOverrun = { commitment_id: string; commitment_name: string; budgeted: number; actual: number; overrun: number };
type UnlabeledTransaction = { id: string; merchant: string | null; amount: number; occurred_at: string; category?: string | null };

export type CloseOutData = {
  month: string;
  total_leftover: number;
  discretionary_leftover: number;
  commitment_buffers: CommitmentBuffer[];
  commitment_overruns: CommitmentOverrun[];
  unlabeled_transactions: UnlabeledTransaction[];
};

const formatINRInt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.abs(n));

export function MonthlyRitualCloseOut() {
  const { month = '2026-04' } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState<CloseOutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: res, error: err } = await supabase.functions.invoke('ritual-close-out', { body: { month } });
      if (cancelled) return;
      if (err) {
        setError(err.message);
      } else if (res?.error) {
        setError(res.error);
      } else {
        setData(res as CloseOutData);
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [month]);

  const handleReflectionLabel = async (txnId: string, label: ReflectionLabel) => {
    // Resolve profile.id (same pattern as HomePage/ChatPage)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user.id).single();
    if (!profile) throw new Error('Profile not found');

    const { error: insertErr } = await supabase
      .from('reflections')
      .insert({ user_id: profile.id, transaction_id: txnId, label });
    if (insertErr) throw insertErr;
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[#E4ECE6] items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#5F5E5A] mt-3">Closing out…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col h-full bg-[#E4ECE6] items-center justify-center p-6 text-center">
        <p className="font-medium text-[#1A1A1A] mb-2">Could not load close-out</p>
        <p className="text-sm text-[#5F5E5A] mb-4">{error ?? 'Unknown error'}</p>
        <button
          type="button"
          onClick={() => navigate('/home')}
          className="px-4 py-2 rounded-full bg-[#1A1A1A] text-white text-sm font-medium"
        >
          Back to home
        </button>
      </div>
    );
  }

  const monthName = formatMonthName(data.month); // e.g. "April"
  const nextMonthName = getNextMonthName(data.month); // e.g. "May" — for "X starts fresh" copy
  const isPositive = data.total_leftover > 0;
  const isExact = Math.abs(data.total_leftover) < 1; // within ₹1 of zero
  const continueLabel = isPositive ? 'Continue to rollover' : `Close out ${monthName}`;

  return (
    <div className="flex flex-col h-full bg-[#E4ECE6]">
      {/* Stream 0F: vertical-stack ritual header — back arrow row, then
          eyebrow "Monthly check-in · N of 6", then title at 36px.
          CloseOut is Step 1 of 6 per master plan §5.1. */}
      <header className="flex-shrink-0" style={{ padding: '14px 22px 8px' }}>
        <div style={{ marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => navigate('/home')}
            aria-label="Cancel and return home"
            className="text-[#1A1A1A] hover:opacity-70 transition-opacity"
            style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <ArrowLeft size={20} />
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#888780', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>
          Monthly check-in · 1 of 7
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 400, color: '#1A1A1A', lineHeight: 1.2, letterSpacing: '-0.8px', margin: 0 }}>
          Closing out {monthName}
        </h1>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-4">
        {/* Hero: total leftover */}
        <Card variant="hero" className="mb-3 flex flex-col items-start">
          <div className="text-xs font-medium tracking-wider uppercase text-[#5F5E5A] mb-2">
            {isPositive ? 'You finished with' : isExact ? 'You finished at' : `${monthName} closed at a deficit of`}
          </div>
          <div
            className="mb-3"
            style={{
              fontSize: 56,
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: '-1.5px',
              color: isPositive || isExact ? '#1A1A1A' : '#791F1F',
            }}
          >
            {!isPositive && !isExact ? '−' : ''}{formatINRInt(data.total_leftover)}
          </div>
          <div className="text-sm text-[#5F5E5A] leading-relaxed">
            {isPositive
              ? 'Across discretionary spending and commitment buffers.'
              : isExact
                ? 'You spent almost exactly what you had to spend.'
                : `${monthName} closed at a deficit. ${nextMonthName} starts fresh — nothing to roll forward.`}
          </div>
        </Card>

        {/* Commitments breakdown */}
        {(data.commitment_overruns.length > 0 || data.commitment_buffers.length > 0) && (
          <Card className="mb-3">
            <SectionHeader title="Commitments" />
            <div className="flex flex-col divide-y divide-borderSoft">
              {/* Overruns first (the felt-consequence stories) */}
              {data.commitment_overruns.map(o => (
                <div key={o.commitment_id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[#1A1A1A] truncate">{o.commitment_name}</div>
                    <div className="text-xs text-[#5F5E5A] truncate">
                      Budgeted {formatINRInt(o.budgeted)} · Actual {formatINRInt(o.actual)}
                    </div>
                  </div>
                  <Pill variant="red">−{formatINRInt(o.overrun)}</Pill>
                </div>
              ))}
              {/* Buffers next, sorted largest first by Edge Function */}
              {data.commitment_buffers.map(b => (
                <div key={b.commitment_id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[#1A1A1A] truncate">{b.commitment_name}</div>
                    <div className="text-xs text-[#5F5E5A] truncate">
                      Budgeted {formatINRInt(b.budgeted)} · Actual {formatINRInt(b.actual)}
                    </div>
                  </div>
                  <Pill variant="sage">+{formatINRInt(b.buffer)}</Pill>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Discretionary leftover */}
        <Card className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-medium text-[#1A1A1A]">Discretionary leftover</div>
            <div className="text-xs text-[#5F5E5A] mt-1">
              Income minus commitments minus discretionary spend.
            </div>
          </div>
          <div className={`font-medium flex-shrink-0 ${data.discretionary_leftover >= 0 ? 'text-[#1A1A1A]' : 'text-[#791F1F]'}`}>
            {data.discretionary_leftover < 0 ? '−' : ''}{formatINRInt(data.discretionary_leftover)}
          </div>
        </Card>

        {/* Reflection prompts */}
        {data.unlabeled_transactions.length > 0 && (
          <Card className="mb-3">
            <SectionHeader title="Looking back" />
            <div className="text-xs text-[#5F5E5A] mb-1">
              Label how these felt. Helps Savio learn your patterns.
            </div>
            <div className="flex flex-col divide-y divide-borderSoft">
              {data.unlabeled_transactions.map(t => (
                <ReflectionLabelRow
                  key={t.id}
                  transaction={t}
                  onLabel={(label) => handleReflectionLabel(t.id, label)}
                />
              ))}
            </div>
          </Card>
        )}

        {/* Continue */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              if (isPositive) {
                navigate(`/ritual/${data.month}/rollover`);
              } else {
                navigate(`/ritual/${data.month}/complete`);
              }
            }}
            className="w-full px-5 py-3 rounded-full bg-[#1A1A1A] text-white text-base font-medium transition-opacity hover:opacity-90"
          >
            {continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
