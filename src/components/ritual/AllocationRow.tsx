import { Target, Shield, CalendarPlus, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ActiveGoal = {
  id: string;
  label: string;
  current_amount: number;
  target_amount: number;
  monthly_contribution: number | null;
};

export type Destination =
  | { kind: 'goal';           goal: ActiveGoal }
  | { kind: 'emergency_fund'; goal: ActiveGoal }
  | { kind: 'carry_forward' };

// Stable string key used both for React list keys and the "already allocated"
// dedup set the parent maintains. Emergency fund collapses to a single key
// since there's exactly one emergency-fund goal in the model.
export const destKey = (d: Destination): string => {
  switch (d.kind) {
    case 'goal':           return `goal:${d.goal.id}`;
    case 'emergency_fund': return 'emergency_fund';
    case 'carry_forward':  return 'carry_forward';
  }
};

export const destLabel = (d: Destination): string => {
  switch (d.kind) {
    case 'goal':           return d.goal.label;
    case 'emergency_fund': return d.goal.label;
    case 'carry_forward':  return 'Carry forward to next month';
  }
};

const formatINRInt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
    .format(Math.max(0, Math.round(n)));

function KindIcon({ kind }: { kind: Destination['kind'] | 'empty' }) {
  if (kind === 'goal') {
    return (
      <div className="w-10 h-10 rounded-xl bg-[#DEF2CB] flex items-center justify-center flex-shrink-0">
        <Target size={18} className="text-[#3B6D11]" />
      </div>
    );
  }
  if (kind === 'emergency_fund') {
    return (
      <div className="w-10 h-10 rounded-xl bg-[#DCEEFF] flex items-center justify-center flex-shrink-0">
        <Shield size={18} className="text-[#0C447C]" />
      </div>
    );
  }
  if (kind === 'carry_forward') {
    return (
      <div className="w-10 h-10 rounded-xl bg-[#FCF1CC] flex items-center justify-center flex-shrink-0">
        <CalendarPlus size={18} className="text-[#854F0B]" />
      </div>
    );
  }
  return <div className="w-10 h-10 rounded-xl bg-black/[0.04] flex-shrink-0" />;
}

export type AllocationRowProps = {
  index: number;
  destinations: Destination[];
  /** Destination keys used in OTHER rows. This row disables them in its picker. */
  usedKeys: Set<string>;
  selectedDestination: Destination | null;
  amount: number;
  /** Amount cap = remaining unallocated + this row's current amount. Stops a user from typing more than the leftover supports. */
  maxAmount: number;
  onDestinationChange: (dest: Destination | null) => void;
  onAmountChange: (amount: number) => void;
  /** Omitted on index 0 — first row can't be removed, only edited. */
  onRemove?: () => void;
};

export function AllocationRow({
  index,
  destinations,
  usedKeys,
  selectedDestination,
  amount,
  maxAmount,
  onDestinationChange,
  onAmountChange,
  onRemove,
}: AllocationRowProps) {
  const selectedKey = selectedDestination ? destKey(selectedDestination) : '';

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    if (!key) { onDestinationChange(null); return; }
    const next = destinations.find(d => destKey(d) === key) ?? null;
    onDestinationChange(next);
  };

  const handleAmount = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') { onAmountChange(0); return; }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) { onAmountChange(0); return; }
    // Cap at maxAmount so the user can't allocate more than the leftover supports.
    onAmountChange(Math.min(Math.floor(parsed), Math.floor(maxAmount)));
  };

  return (
    <div className="bg-white rounded-2xl border border-borderSoft p-3 flex items-center gap-3">
      <KindIcon kind={selectedDestination?.kind ?? 'empty'} />

      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <select
          value={selectedKey}
          onChange={handleSelect}
          aria-label={`Allocation ${index + 1} destination`}
          className={cn(
            'w-full bg-transparent text-sm font-medium text-[#1A1A1A] py-1',
            'border-0 border-b border-borderSoft focus:outline-none focus:border-[#0C447C]',
            'truncate cursor-pointer',
          )}
        >
          <option value="" disabled>Choose destination…</option>
          {destinations.map(d => {
            const key = destKey(d);
            const isUsedElsewhere = usedKeys.has(key);
            return (
              <option key={key} value={key} disabled={isUsedElsewhere}>
                {destLabel(d)}{isUsedElsewhere ? ' · already allocated' : ''}
              </option>
            );
          })}
        </select>

        <div className="flex items-center gap-2">
          <span className="text-sm text-[#5F5E5A] flex-shrink-0">₹</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={amount === 0 ? '' : String(amount)}
            onChange={handleAmount}
            placeholder="0"
            aria-label={`Allocation ${index + 1} amount`}
            className="flex-1 bg-transparent text-base font-medium text-[#1A1A1A] py-1 border-0 focus:outline-none placeholder:text-[#888780] placeholder:font-normal"
          />
          {amount > 0 && (
            <span className="text-xs text-[#5F5E5A] flex-shrink-0">{formatINRInt(amount)}</span>
          )}
        </div>
      </div>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove allocation ${index + 1}`}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[#5F5E5A] hover:bg-black/[0.04] hover:text-[#791F1F] transition-colors flex-shrink-0"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
