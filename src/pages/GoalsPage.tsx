import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BottomNav } from '../components/layout/BottomNav';
import { Card, Pill } from '../components/primitives';
import { Snackbar } from '../components/profile/Snackbar';
import { formatRupeesIndian, inrCompact } from '../lib/formatters';
import { formatGoalDueDate } from '../lib/dates';
import { getStatusFor } from '../lib/goal-status';
import { getMilestoneFor } from '../lib/goal-milestones';
import { DEMO_MODE_MESSAGE } from '../lib/copy';
import { SavedDecisionsSection, type SavedDecisionRow } from '../components/goals/SavedDecisionsSection';

// Phase B3: Goals surface per JSX preview lines 689-776.
//
// Layout: page header (matches Profile/Reflect) → 3 goal cards → "Add a
// goal" presentational dashed-border button. Empty-state card if no
// active goals (defensive — Priya always has 3 seeded).
//
// Status pills and milestones are hardcoded per goal label
// (src/lib/goal-status.ts, src/lib/goal-milestones.ts). V2 derives both
// from real contribution + decision ledgers — see PM_DECISIONS B.7 to
// be banked in Phase D patch.

type GoalRow = {
  id: string;
  label: string;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number | null;
  target_date: string | null;
  status: string | null;
  priority: number | null;
};

// Stream 0.5i: snackbar copy sourced from DEMO_MODE_MESSAGE — same line
// across all [PRESENTATIONAL] edit-action stubs.

export function GoalsPage() {
  const navigate = useNavigate();
  const [goals, setGoals] = useState<GoalRow[]>([]);
  // C.27 (Stream 0.5p #6) — most-recent 3 saved decisions, surfaced
  // below the goal cards.
  const [savedDecisions, setSavedDecisions] = useState<SavedDecisionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackMessage, setSnackMessage] = useState<string | null>(null);
  const dismissSnack = useCallback(() => setSnackMessage(null), []);

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

      const [{ data: goalsData }, { data: savedData }] = await Promise.all([
        supabase.from('goals')
          .select('id, label, target_amount, current_amount, monthly_contribution, target_date, status, priority')
          .eq('user_id', profile.id)
          .eq('status', 'active')
          .order('priority', { ascending: true }),
        supabase.from('saved_decisions')
          .select('id, decision_text, verdict, decision_data, decided_at')
          .eq('user_id', profile.id)
          .order('decided_at', { ascending: false })
          .limit(3),
      ]);

      if (cancelled) return;
      setGoals((goalsData ?? []) as GoalRow[]);
      setSavedDecisions((savedData ?? []) as SavedDecisionRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#E4ECE6]">
      {/* Header — standard pattern matching Profile / Reflect */}
      <header className="flex-shrink-0 px-5 pt-4 pb-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/home')}
          aria-label="Back to home"
          className="w-9 h-9 rounded-full flex items-center justify-center text-[#1A1A1A] hover:bg-black/[0.04] transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 36, fontWeight: 400, color: '#1A1A1A', lineHeight: 1.2, letterSpacing: '-0.8px' }}>
          Goals
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ padding: '0 16px 24px' }}>
        <div className="flex flex-col" style={{ gap: 12 }}>
          {loading ? (
            <div className="flex justify-center" style={{ padding: '24px 0' }}>
              <div className="w-6 h-6 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : goals.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', padding: '12px 4px' }}>
                <div style={{ fontSize: 14, color: '#1A1A1A', marginBottom: 6 }}>
                  No goals yet.
                </div>
                <div style={{ fontSize: 12.5, color: '#5F5E5A', lineHeight: 1.45 }}>
                  Set up your first savings goal to start tracking progress.
                </div>
              </div>
            </Card>
          ) : (
            goals.map(g => <GoalCard key={g.id} goal={g} />)
          )}

          {/* Add a goal — presentational (V2) */}
          <button
            type="button"
            onClick={() => setSnackMessage(DEMO_MODE_MESSAGE)}
            className="hover:bg-black/[0.02] transition-colors"
            style={{
              marginTop: 4,
              padding: '14px 20px',
              backgroundColor: 'transparent',
              border: '0.5px dashed rgba(0,0,0,0.14)',
              borderRadius: 22,
              color: '#1A1A1A',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontFamily: 'inherit',
            }}
          >
            <Plus size={15} strokeWidth={2} />
            Add a goal
          </button>
        </div>

        {/* C.27 (Stream 0.5p #6) — Saved Decisions section below the
            goals + add-a-goal block. Empty state copy frames the loop
            intent ("When you save a chat verdict, it appears here for
            you to revisit"). Most-recent 3; expand to re-render the
            original verdict via VerdictCard readOnly. */}
        {!loading && <SavedDecisionsSection decisions={savedDecisions} />}
      </div>

      <Snackbar message={snackMessage} onDismiss={dismissSnack} />
      <BottomNav />
    </div>
  );
}

function GoalCard({ goal }: { goal: GoalRow }) {
  const target = Number(goal.target_amount);
  const current = Number(goal.current_amount ?? 0);
  const monthly = Number(goal.monthly_contribution ?? 0);
  const pct = target > 0 ? Math.round((current / target) * 100) : 0;
  const dueLabel = formatGoalDueDate(goal.target_date);

  const { status, variant } = getStatusFor(goal.label);
  const milestone = getMilestoneFor(goal.label);
  const MilestoneIcon = milestone?.icon;

  return (
    <Card style={{ padding: 18 }}>
      {/* Top row: label + sublabel + status pill */}
      <div
        className="flex justify-between items-start"
        style={{ marginBottom: 14, gap: 12 }}
      >
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 16, color: '#1A1A1A', fontWeight: 500, lineHeight: 1.2 }}>
            {goal.label}
          </div>
          <div style={{ fontSize: 12, color: '#888780', marginTop: 3 }}>
            {dueLabel ? `Target ${dueLabel}` : 'No target date'}
            {monthly > 0 ? ` · ${formatRupeesIndian(monthly)}/month` : ''}
          </div>
        </div>
        <Pill variant={variant} size="md">{status}</Pill>
      </div>

      {/* Hero row: current amount + target/percent */}
      <div
        className="flex items-baseline justify-between"
        style={{ marginBottom: 10 }}
      >
        <span
          style={{
            fontSize: 22,
            color: '#1A1A1A',
            fontWeight: 500,
            letterSpacing: '-0.5px',
          }}
        >
          {inrCompact(current)}
        </span>
        <span style={{ fontSize: 13, color: '#5F5E5A' }}>
          of {inrCompact(target)} ·{' '}
          <span style={{ color: '#1A1A1A', fontWeight: 500 }}>{pct}%</span>
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 6,
          borderRadius: 999,
          backgroundColor: 'rgba(0,0,0,0.05)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: `${Math.min(100, Math.max(0, pct))}%`,
            height: '100%',
            backgroundColor: '#58B9FF',
            borderRadius: 999,
            transition: 'width 500ms ease-out',
          }}
        />
      </div>

      {/* Milestone callout — only if defined for this goal */}
      {milestone && MilestoneIcon && (
        <div
          style={{
            marginTop: 14,
            padding: '10px 12px',
            backgroundColor: '#DEF2CB',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <MilestoneIcon size={14} color="#3B6D11" />
          <span style={{ fontSize: 12.5, color: '#3B6D11', fontWeight: 500, lineHeight: 1.35 }}>
            {milestone.text}
          </span>
        </div>
      )}
    </Card>
  );
}
