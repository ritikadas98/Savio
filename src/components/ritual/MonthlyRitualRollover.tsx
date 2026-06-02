import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatMonthName, defaultPendingMonth } from '../../lib/dates';
import type { CloseOutData } from './MonthlyRitualCloseOut';
import {
  AllocationRow,
  type ActiveGoal,
  type Destination,
  destKey,
  destLabel,
} from './AllocationRow';

type Allocation = {
  destination: Destination | null;
  amount: number;
};

const formatINRInt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
    .format(Math.abs(Math.round(n)));

// Heuristic: a goal is the emergency fund if its label contains "emergency".
// Matches the prior single-destination version's split. The seed has exactly
// one such goal ("Emergency fund").
const isEmergency = (g: ActiveGoal) => g.label.toLowerCase().includes('emergency');

export function MonthlyRitualRollover() {
  const { month: rawMonth } = useParams();
  const month = rawMonth ?? defaultPendingMonth();
  const navigate = useNavigate();

  const [data, setData] = useState<CloseOutData | null>(null);
  const [goals, setGoals] = useState<ActiveGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch close-out + active goals
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
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

      // Negative-leftover branch: skip the rollover screen entirely. The
      // close-out summary's "Close out April" button routes straight to
      // /complete (which fires the empty-allocation RPC). Defensive guard
      // here in case a user lands here via direct URL.
      if (closeOut.total_leftover <= 0) {
        navigate(`/ritual/${month}/complete`, { replace: true });
        return;
      }

      const fetchedGoals = (goalsRes.data as ActiveGoal[]) ?? [];
      setData(closeOut);
      setGoals(fetchedGoals);

      // Initialize one allocation row, prefilled with the full leftover and
      // the first non-emergency goal selected. Empty if no goals available
      // — user must pick from the dropdown.
      const firstGoal = fetchedGoals.find(g => !isEmergency(g));
      const defaultDest: Destination | null = firstGoal
        ? { kind: 'goal', goal: firstGoal }
        : fetchedGoals.find(isEmergency)
          ? { kind: 'emergency_fund', goal: fetchedGoals.find(isEmergency)! }
          : { kind: 'carry_forward' };
      setAllocations([{ destination: defaultDest, amount: Math.floor(closeOut.total_leftover) }]);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [month, navigate]);

  // Build the flat destinations list once: goals (non-emergency) + emergency + carry_forward.
  const destinations: Destination[] = useMemo(() => {
    const list: Destination[] = [];
    for (const g of goals) {
      if (isEmergency(g)) continue;
      list.push({ kind: 'goal', goal: g });
    }
    const ef = goals.find(isEmergency);
    if (ef) list.push({ kind: 'emergency_fund', goal: ef });
    list.push({ kind: 'carry_forward' });
    return list;
  }, [goals]);

  const totalLeftover = data ? Math.floor(data.total_leftover) : 0;
  const totalAllocated = allocations.reduce((s, a) => s + a.amount, 0);
  const remaining = totalLeftover - totalAllocated;

  const isReady =
    remaining === 0 &&
    allocations.length > 0 &&
    allocations.every(a => a.destination !== null && a.amount > 0);

  // Compute "used keys excluding row i" so each row's <select> can disable
  // destinations already picked elsewhere without disabling its own selection.
  const usedKeysExcluding = (i: number): Set<string> => {
    const s = new Set<string>();
    for (let j = 0; j < allocations.length; j++) {
      if (j === i) continue;
      const d = allocations[j].destination;
      if (d) s.add(destKey(d));
    }
    return s;
  };

  const addRow = () => {
    setAllocations(prev => [...prev, { destination: null, amount: 0 }]);
  };

  const removeRow = (idx: number) => {
    if (idx === 0) return;
    setAllocations(prev => prev.filter((_, j) => j !== idx));
  };

  const setDestination = (idx: number, dest: Destination | null) => {
    setAllocations(prev => prev.map((a, j) => (j === idx ? { ...a, destination: dest } : a)));
  };

  const setAmount = (idx: number, amount: number) => {
    setAllocations(prev => prev.map((a, j) => (j === idx ? { ...a, amount } : a)));
  };

  const handleConfirm = async () => {
    if (!data || !isReady || submitting) return;
    setSubmitting(true);
    try {
      const sourceBreakdown = {
        discretionary_leftover: data.discretionary_leftover,
        commitment_buffers: data.commitment_buffers,
        commitment_overruns: data.commitment_overruns,
      };

      // Build RPC payload: one object per allocation. source_breakdown
      // duplicated across rows (intentional — preserves the append-only
      // audit invariant on every rollover_allocations row).
      const payload = allocations.map(a => ({
        destination_kind: a.destination!.kind,
        destination_goal_id:
          a.destination!.kind === 'carry_forward' ? null : a.destination!.goal.id,
        total_amount: a.amount,
        source_breakdown: sourceBreakdown,
      }));

      const { error: rpcErr } = await supabase.rpc('complete_monthly_ritual', {
        p_month_year: data.month,
        p_allocations: payload,
      });
      if (rpcErr) throw rpcErr;

      // Summary string for the complete screen. Single-destination keeps
      // the prior "₹X to <name>" phrasing; multi-destination shows the
      // split count so the user gets confirmation it landed as intended.
      const summary =
        allocations.length === 1
          ? destLabel(allocations[0].destination!)
          : `${allocations.length} destinations`;

      navigate(`/ritual/${data.month}/complete`, {
        state: {
          total_amount: totalAllocated,
          destination_kind: allocations.length === 1 ? allocations[0].destination!.kind : 'split',
          destination_label: summary,
          allocation_count: allocations.length,
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
        <div className="w-8 h-8 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col h-full bg-[#E4ECE6] items-center justify-center p-6 text-center">
        <p className="font-medium text-[#1A1A1A] mb-2">Could not load rollover</p>
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

  const monthName = formatMonthName(data.month);

  // Running total status indicator: three states for the visual feedback the
  // spec calls "load-bearing for UX clarity."
  let statusLine: { text: string; color: string };
  if (remaining > 0) {
    statusLine = {
      text: `${formatINRInt(totalAllocated)} of ${formatINRInt(totalLeftover)} allocated · ${formatINRInt(remaining)} remaining`,
      color: 'text-[#5F5E5A]',
    };
  } else if (remaining < 0) {
    statusLine = {
      text: `${formatINRInt(totalAllocated)} of ${formatINRInt(totalLeftover)} allocated · ${formatINRInt(-remaining)} over limit`,
      color: 'text-[#791F1F]',
    };
  } else {
    statusLine = {
      text: `${formatINRInt(totalLeftover)} of ${formatINRInt(totalLeftover)} allocated · ready to confirm`,
      color: 'text-[#3B6D11]',
    };
  }

  // Confirm button copy
  let confirmCopy: string;
  if (submitting) {
    confirmCopy = 'Saving…';
  } else if (remaining > 0) {
    confirmCopy = `Allocate ${formatINRInt(remaining)} more`;
  } else if (remaining < 0) {
    confirmCopy = `Reduce by ${formatINRInt(-remaining)}`;
  } else if (allocations.length === 1) {
    confirmCopy = `Confirm — ${formatINRInt(totalAllocated)} to ${destLabel(allocations[0].destination!)}`;
  } else {
    confirmCopy = `Confirm — split across ${allocations.length} destinations`;
  }

  // Disable "+ Add destination" once every available destination is used.
  // Without this, a user could add an empty row that can't be filled.
  const usedAcross = new Set<string>();
  for (const a of allocations) {
    if (a.destination) usedAcross.add(destKey(a.destination));
  }
  const canAddMore = usedAcross.size < destinations.length && allocations.length < destinations.length;

  return (
    <div className="flex flex-col h-full bg-[#E4ECE6]">
      {/* Stream 0F: vertical-stack ritual header. Rollover is Step 2 of 6
          per master plan §5.1. */}
      <header className="flex-shrink-0" style={{ padding: '14px 22px 8px' }}>
        <div style={{ marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => navigate(`/ritual/${data.month}`)}
            aria-label="Back to close-out summary"
            className="text-[#1A1A1A] hover:opacity-70 transition-opacity"
            style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <ArrowLeft size={20} />
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#888780', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>
          Monthly check-in · 2 of 7
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 400, color: '#1A1A1A', lineHeight: 1.2, letterSpacing: '-0.8px', margin: 0 }}>
          {monthName}&rsquo;s {formatINRInt(totalLeftover)}
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-4 space-y-3">
        <div className="text-sm text-[#5F5E5A] px-1 pb-1">
          Pick where each rupee goes. Add more destinations if you want to split it.
        </div>

        {allocations.map((a, i) => (
          <AllocationRow
            key={i}
            index={i}
            destinations={destinations}
            usedKeys={usedKeysExcluding(i)}
            selectedDestination={a.destination}
            amount={a.amount}
            maxAmount={a.amount + Math.max(0, remaining)}
            onDestinationChange={(dest) => setDestination(i, dest)}
            onAmountChange={(amount) => setAmount(i, amount)}
            onRemove={i === 0 ? undefined : () => removeRow(i)}
          />
        ))}

        {canAddMore && (
          <button
            type="button"
            onClick={addRow}
            className="w-full px-4 py-2.5 rounded-full border border-dashed text-sm font-medium flex items-center justify-center gap-2 hover:bg-black/[0.02] transition-colors"
            style={{ borderColor: 'rgba(0,0,0,0.14)', color: '#1A1A1A' }}
          >
            <Plus size={16} />
            Add destination
          </button>
        )}

        <div className={`text-sm text-center pt-1 ${statusLine.color}`} aria-live="polite">
          {statusLine.text}
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isReady || submitting}
            className={`w-full px-5 py-3 rounded-full text-base font-medium transition-opacity ${
              isReady && !submitting
                ? 'bg-[#1A1A1A] text-white hover:opacity-90'
                : 'bg-[#888780]/30 text-[#5F5E5A] cursor-not-allowed'
            }`}
          >
            {confirmCopy}
          </button>
        </div>
      </div>
    </div>
  );
}
