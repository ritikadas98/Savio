import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Compass, Sailboat, Hammer, ChevronRight, ChevronDown, LogOut, type LucideIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BottomNav } from '../components/layout/BottomNav';
import { ReviewerConsole } from '../components/profile/ReviewerConsole';
import { Card, Pill } from '../components/primitives';
import { Snackbar } from '../components/profile/Snackbar';
import { formatRupeesIndian, ordinalSuffix, formatDateLong } from '../lib/formatters';
import { DEMO_MODE_MESSAGE } from '../lib/copy';
import { logoutFromPriya } from '../lib/auth';
import { getUserRules, formatSafetyNet, formatImpulseWait } from '../lib/user-rules';
import { getSavingsState } from '../lib/savings';
import { computeStsBreakdown } from '../lib/safeToSpend';
import { getPreviousMonthFirstDate } from '../lib/dates';

// Stream 0.5n — Profile identity hero reads the same localStorage avatar
// hint as ProfilePill (Phase C4). DB stays authoritative for chat behavior
// (Priya remains Strategist regardless per PM_DECISIONS.C.18). localStorage
// wins for presentation. Threshold for useUserAvatar() hook extraction is
// 3+ sites; ProfilePill + ProfilePage = 2, so inline pattern stays.
type AvatarKey = 'strategist' | 'adventurer' | 'builder';

const AVATAR_ICONS: Record<AvatarKey, LucideIcon> = {
  strategist: Compass,
  adventurer: Sailboat,
  builder:    Hammer,
};

const AVATAR_LABELS: Record<AvatarKey, string> = {
  strategist: 'The Strategist',
  adventurer: 'The Adventurer',
  builder:    'The Builder',
};

function isAvatarKey(v: unknown): v is AvatarKey {
  return v === 'strategist' || v === 'adventurer' || v === 'builder';
}

// Same pattern as the avatar above — localStorage-first label resolution
// for the life-stage pill. Labels match the onboarding Step 6 options
// verbatim (JSX line 763-768) so the Profile pill reads identically to
// what the user picked. Presentation-only; DB profile.life_stage stays
// the canonical Priya value for chat grounding.
type LifeStageKey = 'student' | 'working_no_dependents' | 'supporting_dependents' | 'pre_retiree';

const LIFE_STAGE_LABELS: Record<LifeStageKey, string> = {
  student:                'Student',
  working_no_dependents:  'Working, no dependents',
  supporting_dependents:  'Supporting dependents',
  pre_retiree:            'Planning for retirement',
};

function isLifeStageKey(v: unknown): v is LifeStageKey {
  return v === 'student' || v === 'working_no_dependents'
      || v === 'supporting_dependents' || v === 'pre_retiree';
}

type ProfileRow = {
  full_name: string | null;
  avatar: string | null;
  life_stage: string | null;
  monthly_income_net: number | null;
  anchor_day_of_month: number | null;
  primary_bank: string | null;
  disclaimer_acknowledged_at: string | null;
  // D.49 (Stream 0.5t piece #4) — user rules columns
  unearmarked_liquid?: number | null;
  safety_net: number | null;
  impulse_wait_threshold: number | null;
  impulse_wait_hours: number | null;
  daily_sps_floor: number | null;
};

// D.31 (Stream 0.5q piece #2) — Profile "Your commitments" section.
// Fixed-only filter (kind = 'fixed') excludes the 3 variable budgets
// (Groceries / Eating out / Transport) which appear in close-out screen 1
// and the ritual flow, not here. Read-only for Monday delivery — edit
// affordances are V2 Tier 1. Order: amount DESC so largest obligations
// surface first (Rent ₹22K → ... → Spotify ₹119).
type FixedCommitment = {
  id: string;
  label: string;
  amount: number;
  frequency: string | null;
  category: string | null;
};

// D.65 (Spec 2 + 2.2) — goal shape covering both derivations on the
// Profile surface: savings-state (current_amount + backs_safety_net)
// AND STS breakdown (monthly_contribution + status).
type GoalRow = {
  id: string;
  label: string;
  current_amount: number | null;
  monthly_contribution: number | null;
  backs_safety_net: boolean | null;
  status: string | null;
};

// Stream 0.5n+ — formatLifeStage helper retired in favor of LIFE_STAGE_LABELS
// lookup (same pattern as AVATAR_LABELS), so the displayed copy matches the
// onboarding Step 6 options exactly. The old title-case helper produced
// "Supporting Dependents"; onboarding shows "Supporting dependents".

// Pre-0.5n this helper produced the human label from raw DB string. Stream
// 0.5n replaces its call sites with AVATAR_LABELS lookups keyed on a
// localStorage-first avatar key — removing this helper to avoid drift
// between two label-source paths.

// Phase B1: rows that read profile data but stub edit on tap. Per
// PM_DECISIONS three-mode build classification, these are [PRESENTATIONAL].
// Stream 0.5i: snackbar copy sourced from DEMO_MODE_MESSAGE constant —
// no per-surface variation.

// JSX preview line 836-838 disclaimer copy. Spec doc has a slightly longer
// 5-sentence version (adds "doesn't store your financial info"); using that
// per the spec doc directive ("don't paraphrase").
const DISCLAIMER_BODY = "Savio helps you think about your money. It is not a financial advisor, investment advisor, or registered financial planner. All numerical estimates are AI-generated and may contain errors. Verify all calculations independently before making important decisions. Savio does not store your financial information beyond your local session.";

// Schema column profiles.disclaimer_acknowledged_at exists but seed never
// populates it. Fall back to this static date — matches Priya's persona
// timeline (April 2026 onboarding before May 1 demo state).
const FALLBACK_ACK_DATE = '2026-04-12';

function ProfileSectionHeader({ title }: { title: string }) {
  return (
    <h2
      style={{
        fontSize: 13,
        fontWeight: 500,
        color: '#5F5E5A',
        padding: '20px 6px 8px',
        margin: 0,
      }}
    >
      {title}
    </h2>
  );
}

type ProfileFieldRowProps = {
  // D.65 Spec 2.2 — label widened to ReactNode so flow rows can carry a
  // small sublabel (e.g. "Investing — savings") inline. Plain strings
  // still work; existing callers unchanged.
  label: React.ReactNode;
  value: React.ReactNode;
  onClick?: () => void;
  isLast?: boolean;
};

function ProfileFieldRow({ label, value, onClick, isLast }: ProfileFieldRowProps) {
  const content = (
    <>
      <span style={{ fontSize: 14, color: '#1A1A1A', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 14, color: '#5F5E5A', display: 'flex', alignItems: 'center', gap: 8 }}>
        {value}
        {onClick && <ChevronRight size={16} className="text-[#888780]" />}
      </span>
    </>
  );

  const base: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '14px 16px',
    borderBottom: isLast ? 'none' : '0.5px solid rgba(0,0,0,0.07)',
    textAlign: 'left',
  };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="hover:bg-black/[0.02] transition-colors"
        style={{ ...base, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        {content}
      </button>
    );
  }
  return <div style={base}>{content}</div>;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [commitments, setCommitments] = useState<FixedCommitment[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [carryForward, setCarryForward] = useState<number>(0);
  // D.37 (Stream 0.5r piece #5) — commitments default collapsed. Total
  // card itself is the affordance — single tappable element, no separate
  // expand button. Per-session state; resets on navigation away.
  // D.65 Spec 2.2 — split into two independent toggles: fixed costs +
  // investing. They expand independently so a user looking at one
  // detail doesn't have to scroll past the other.
  const [fixedCostsExpanded, setFixedCostsExpanded] = useState(false);
  const [investingExpanded, setInvestingExpanded] = useState(false);
  const [snackMessage, setSnackMessage] = useState<string | null>(null);

  // Stream 0.5n — localStorage avatar hint, read once on mount (matches
  // ProfilePill pattern). Skip-path users (no onboarding) have no key set;
  // walkthrough users have one of {strategist, adventurer, builder}. DB
  // value is the final fallback; ultimate default is 'strategist'.
  const [demoAvatar, setDemoAvatar] = useState<AvatarKey | null>(null);
  const [demoLifeStage, setDemoLifeStage] = useState<LifeStageKey | null>(null);
  useEffect(() => {
    try {
      const storedAvatar = typeof window !== 'undefined' ? localStorage.getItem('savio_demo_avatar') : null;
      if (isAvatarKey(storedAvatar)) setDemoAvatar(storedAvatar);
      const storedStage = typeof window !== 'undefined' ? localStorage.getItem('savio_demo_life_stage') : null;
      if (isLifeStageKey(storedStage)) setDemoLifeStage(storedStage);
    } catch {
      // private browsing / SSR — defaults stay null, fall through to DB.
    }
  }, []);

  const showStub = useCallback(() => setSnackMessage(DEMO_MODE_MESSAGE), []);
  const dismissSnack = useCallback(() => setSnackMessage(null), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('id, full_name, avatar, life_stage, monthly_income_net, anchor_day_of_month, primary_bank, disclaimer_acknowledged_at, safety_net, impulse_wait_threshold, impulse_wait_hours, daily_sps_floor, unearmarked_liquid')
        .eq('auth_user_id', user.id)
        .single();
      if (cancelled || !profileRow) return;
      setProfile(profileRow as ProfileRow);

      // D.65 (Spec 2) — goals needed for the savings-state derivation
      // (which goal backs the safety net + its current_amount). Fetched
      // in parallel with commitments.
      const profileId = (profileRow as { id: string }).id;
      // D.65 (Spec 2 + 2.2) — goals feed TWO derivations on this surface:
      //   - getSavingsState reads current_amount + backs_safety_net (cushion)
      //   - computeStsBreakdown reads monthly_contribution (the goals row in
      //     the "This month" flow)
      // Spec 2 originally only selected the first set; Spec 2.2 surfaced
      // the omission as a "Goals −₹0" / inflated-STS display bug. Both
      // sets fetched in one query so the surface stays coherent.
      const { data: goalRows } = await supabase
        .from('goals')
        .select('id, label, current_amount, monthly_contribution, backs_safety_net, status')
        .eq('user_id', profileId);
      if (!cancelled && goalRows) {
        setGoals(goalRows as GoalRow[]);
      }

      // D.31 — pull fixed commitments for the "Your commitments" section.
      // Variable rows (Groceries / Eating out / Transport) intentionally
      // excluded; they're surfaced in the close-out screen + ritual flow.
      const { data: cmtRows } = await supabase
        .from('commitments')
        .select('id, label, amount, frequency, category')
        .eq('user_id', (profileRow as { id: string }).id)
        .eq('kind', 'fixed')
        .order('amount', { ascending: false });
      if (!cancelled && cmtRows) {
        setCommitments(
          cmtRows.map(r => ({
            id: r.id as string,
            label: r.label as string,
            amount: Number(r.amount),
            frequency: (r.frequency as string | null) ?? null,
            category: (r.category as string | null) ?? null,
          })),
        );
      }

      // D.65 Spec 2.2 — carry-forward must match Home/chat (gate #4: same STS
      // across all three surfaces). Same query Home runs (HomePage.tsx:113).
      const { data: cfRows } = await supabase
        .from('rollover_allocations')
        .select('total_amount')
        .eq('user_id', profileId)
        .eq('ritual_month', getPreviousMonthFirstDate())
        .eq('destination_kind', 'carry_forward');
      if (!cancelled && cfRows) {
        setCarryForward((cfRows as Array<{ total_amount: number }>).reduce((s, r) => s + Number(r.total_amount || 0), 0));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // D.65 (Spec 2.2) — canonical decomposition from the shared module.
  // Same source the chat grounding and Home read, so the figures shown
  // here are byte-identical to what those surfaces use (gate #4). The
  // investing/non-investing split is preserved at presentation time per
  // D.64: investing renders as savings, not a cost.
  const stsBreakdown = computeStsBreakdown(
    profile?.monthly_income_net ?? 0,
    // Pass full commitments shape — the module's own filter handles
    // variable-vs-fixed and investing classification.
    commitments.map(c => ({ amount: c.amount, category: c.category, kind: 'fixed' as const })),
    goals,
    carryForward,
  );
  // D.65 (Spec 2.2) — split the commitments display by investing
  // category. Replaces the lumped "Fixed commitments ₹62,468" with two
  // canonical groups (fixed costs ₹47,468 + investing ₹15,000).
  const fixedCostCommitments = commitments.filter(c => {
    const cat = (c.category ?? '').toLowerCase();
    return cat !== 'investing' && cat !== 'investment';
  });
  const investingCommitments = commitments.filter(c => {
    const cat = (c.category ?? '').toLowerCase();
    return cat === 'investing' || cat === 'investment';
  });
  const fixedCostTotal = fixedCostCommitments.reduce((s, c) => s + c.amount, 0);
  const investingTotal = investingCommitments.reduce((s, c) => s + c.amount, 0);

  // D.49 (Stream 0.5t piece #5) — pull rule values via the helper so the
  // displayed strings come from the same getUserRules() path the Edge
  // Function's prompt_builder will also use (drift impossible by design).
  const userRules = getUserRules(profile);

  // D.65 (Spec 2) — savings state from the shared module. Same derivation
  // the chat grounding context reads (supabase/functions/_shared/savings.ts
  // is the Deno mirror of src/lib/savings.ts), so the cushion + floor
  // status surfaced here is byte-identical to what the LLM sees.
  const savings = getSavingsState(profile, goals);

  // D.65 Spec 2.2 — income now read inside the "This month" flow card
  // via stsBreakdown.incomeNet (one canonical source). Standalone
  // `income` variable retired to avoid drift between rendered figure
  // and decomposition source.
  const anchorDay = profile?.anchor_day_of_month ?? 1;
  const bank = profile?.primary_bank ?? 'HDFC';
  const ackDateRaw = profile?.disclaimer_acknowledged_at ?? FALLBACK_ACK_DATE;

  // 0.5n — localStorage wins, then DB, then 'strategist'. Invalid values
  // in any source fall through to 'strategist' via isAvatarKey guard.
  const dbAvatar = profile?.avatar;
  const avatarKey: AvatarKey = demoAvatar ?? (isAvatarKey(dbAvatar) ? dbAvatar : 'strategist');
  const IdentityIcon = AVATAR_ICONS[avatarKey];
  const identityFullLabel = AVATAR_LABELS[avatarKey];                       // "The Strategist"
  const identityShortLabel = identityFullLabel.replace(/^The\s+/, '');      // "Strategist" — for the Rules row

  // localStorage wins, then DB, then 'supporting_dependents'. Invalid values
  // at either source fall through via the isLifeStageKey guard.
  const dbLifeStage = profile?.life_stage;
  const lifeStageKey: LifeStageKey = demoLifeStage
    ?? (isLifeStageKey(dbLifeStage) ? dbLifeStage : 'supporting_dependents');
  const lifeStageLabel = LIFE_STAGE_LABELS[lifeStageKey];

  const displayName = profile?.full_name ?? 'Priya Sharma';

  return (
    <div className="flex flex-col h-full bg-[#E4ECE6]">
      {/* Header */}
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
          Profile
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-6">
        {/* Identity hero — 84×84 circular avPlate with avatar-keyed icon
            (0.5n: was hardcoded Compass; now Compass/Sailboat/Hammer based
            on the localStorage hint, matching ProfilePill on home). */}
        <div className="flex flex-col items-center" style={{ padding: '8px 0 22px' }}>
          <div
            className="flex items-center justify-center"
            style={{
              width: 84,
              height: 84,
              borderRadius: 999,
              backgroundColor: '#DCEEFF',
              color: '#0C447C',
              marginBottom: 14,
            }}
          >
            <IdentityIcon size={36} strokeWidth={1.7} />
          </div>
          <div style={{ fontSize: 22, color: '#1A1A1A', fontWeight: 500, marginBottom: 8 }}>
            {displayName}
          </div>
          <div className="flex flex-wrap justify-center" style={{ gap: 6 }}>
            <Pill variant="navy" size="md">{identityFullLabel}</Pill>
            <Pill variant="neutral" size="md">{lifeStageLabel}</Pill>
          </div>
        </div>

        {/* D.65 Spec 2.2 — "This month" flow. Canonical decomposition
            from computeStsBreakdown (the SAME source Home + chat read),
            so every figure here is byte-identical across surfaces.
            Investing renders here as savings (sublabel), not a fixed
            cost — re-blurring D.64's split would defeat its point.
            Income → Fixed costs → Investing → Goals → Safe to spend.
            Tap targets retained on Income (editable stub) and the
            three derived rows non-clickable. */}
        <ProfileSectionHeader title="This month" />
        <Card className="!p-0">
          <ProfileFieldRow
            label="Income"
            value={`${formatRupeesIndian(stsBreakdown.incomeNet)} net`}
            onClick={showStub}
          />
          <ProfileFieldRow
            label="Fixed costs"
            value={<span style={{ color: '#1A1A1A' }}>−{formatRupeesIndian(stsBreakdown.totalNonInvesting)}</span>}
          />
          <ProfileFieldRow
            label={
              <span>
                Investing
                <span style={{ color: '#888780', fontSize: 12, marginLeft: 6 }}>savings</span>
              </span>
            }
            value={<span style={{ color: '#1A1A1A' }}>−{formatRupeesIndian(stsBreakdown.totalInvesting)}</span>}
          />
          <ProfileFieldRow
            label={
              <span>
                Goals
                <span style={{ color: '#888780', fontSize: 12, marginLeft: 6 }}>savings</span>
              </span>
            }
            value={<span style={{ color: '#1A1A1A' }}>−{formatRupeesIndian(stsBreakdown.totalGoalContrib)}</span>}
          />
          {stsBreakdown.carryForward > 0 && (
            <ProfileFieldRow
              label={
                <span>
                  Carry-forward
                  <span style={{ color: '#888780', fontSize: 12, marginLeft: 6 }}>from last month</span>
                </span>
              }
              value={<span style={{ color: '#1A1A1A' }}>+{formatRupeesIndian(stsBreakdown.carryForward)}</span>}
            />
          )}
          {/* Bottom-line row — visually emphasised as the derived
              result. Slightly heavier divider + bold value so it reads
              as the "= " of the flow. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: '16px 16px',
              borderTop: '1px solid rgba(0,0,0,0.10)',
            }}
          >
            <span style={{ fontSize: 14, color: '#1A1A1A', flex: 1, fontWeight: 500 }}>Safe to spend</span>
            <span style={{ fontSize: 18, color: '#1A1A1A', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {formatRupeesIndian(stsBreakdown.safeToSpend)}
            </span>
          </div>
        </Card>

        {/* D.65 Spec 2.2 — "Savings position" stock card. Separated
            from "This month" because a balance is a different thing
            than a flow. Safety-net AMOUNT lives in Your rules
            (editable); this row is STATUS only (no duplicate ₹1L
            editable affordance). Cushion + rebuild-gap framing
            preserved from Spec 2. */}
        <ProfileSectionHeader title="Savings position" />
        <Card className="!p-0">
          <ProfileFieldRow
            label="Safety net"
            value={
              savings.floorCovered ? (
                <span style={{ color: '#1A1A1A' }}>
                  Covered ✓
                  {savings.backerLabel && (
                    <span style={{ color: '#888780', fontSize: 12, marginLeft: 6 }}>
                      by {savings.backerLabel}
                    </span>
                  )}
                </span>
              ) : (
                <span style={{ color: '#A8533F' }}>Not yet covered</span>
              )
            }
          />
          {savings.floorCovered ? (
            <ProfileFieldRow
              label="Cushion above it"
              value={
                savings.cushion > 0 ? (
                  <span>
                    {formatRupeesIndian(savings.cushion)}
                    <span style={{ color: '#888780', fontSize: 12, marginLeft: 6 }}>
                      reserve, not for spending
                    </span>
                  </span>
                ) : (
                  <span style={{ color: '#888780' }}>none beyond the floor</span>
                )
              }
              isLast
            />
          ) : (
            <ProfileFieldRow
              label="Rebuild gap"
              value={
                <span style={{ color: '#A8533F' /* deficit_breached tone */ }}>
                  {formatRupeesIndian(savings.rebuildGap)} to reach the floor
                </span>
              }
              isLast
            />
          )}
        </Card>

        {/* D.65 Spec 2.2 — Account details (formerly part of "Your
            finances"). Anchor day + primary bank are profile metadata,
            not flow or stock; they belong in their own group. */}
        <ProfileSectionHeader title="Account details" />
        <Card className="!p-0">
          <ProfileFieldRow
            label="Anchor date"
            value={`${ordinalSuffix(anchorDay)} of month`}
            onClick={showStub}
          />
          <ProfileFieldRow
            label="Primary bank"
            value={bank}
            onClick={showStub}
            isLast
          />
        </Card>

        {/* D.65 Spec 2.2 — Your fixed costs (non-investing commitments
            only — D.64 distinction preserved). Default collapsed; total
            row is the tap target. */}
        {fixedCostCommitments.length > 0 && (
          <>
            <ProfileSectionHeader title="Your fixed costs" />
            <Card className="!p-0">
              <button
                type="button"
                onClick={() => setFixedCostsExpanded(e => !e)}
                aria-expanded={fixedCostsExpanded}
                aria-controls="fixed-costs-list"
                className="hover:bg-black/[0.02] transition-colors"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '14px 16px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  borderBottom: fixedCostsExpanded ? '0.5px solid rgba(0,0,0,0.07)' : 'none',
                }}
              >
                <span style={{ flex: 1, fontSize: 13, color: '#5F5E5A', fontWeight: 400 }}>
                  Monthly total
                </span>
                <span style={{ fontSize: 16, color: '#1A1A1A', fontWeight: 500, fontVariantNumeric: 'tabular-nums', marginRight: 10 }}>
                  {formatRupeesIndian(fixedCostTotal)}
                </span>
                <ChevronDown
                  size={20}
                  color="#5A6B5F"
                  style={{
                    transform: fixedCostsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 200ms ease',
                    flexShrink: 0,
                  }}
                  aria-hidden
                />
              </button>
              {fixedCostsExpanded && (
                <div id="fixed-costs-list">
                  {fixedCostCommitments.map((c, i) => (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        padding: '12px 16px',
                        borderBottom: i < fixedCostCommitments.length - 1 ? '0.5px solid rgba(0,0,0,0.07)' : 'none',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: '#1A1A1A', fontWeight: 500, lineHeight: 1.3 }}>
                          {c.label}
                        </div>
                        <div style={{ fontSize: 11, color: '#888780', marginTop: 2, lineHeight: 1.3 }}>
                          {[c.category, c.frequency].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, color: '#1A1A1A', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                        {formatRupeesIndian(c.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {/* D.65 Spec 2.2 — Your investing. SIPs / RDs / PPF rendered as
            a SAVINGS group (not a cost). Same expandable pattern as
            fixed costs. Independent toggle state. */}
        {investingCommitments.length > 0 && (
          <>
            <ProfileSectionHeader title="Your investing" />
            <Card className="!p-0">
              <button
                type="button"
                onClick={() => setInvestingExpanded(e => !e)}
                aria-expanded={investingExpanded}
                aria-controls="investing-list"
                className="hover:bg-black/[0.02] transition-colors"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '14px 16px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  borderBottom: investingExpanded ? '0.5px solid rgba(0,0,0,0.07)' : 'none',
                }}
              >
                <span style={{ flex: 1, fontSize: 13, color: '#5F5E5A', fontWeight: 400 }}>
                  Monthly total
                  <span style={{ color: '#888780', fontSize: 11, marginLeft: 6 }}>
                    savings, auto-debited
                  </span>
                </span>
                <span style={{ fontSize: 16, color: '#1A1A1A', fontWeight: 500, fontVariantNumeric: 'tabular-nums', marginRight: 10 }}>
                  {formatRupeesIndian(investingTotal)}
                </span>
                <ChevronDown
                  size={20}
                  color="#5A6B5F"
                  style={{
                    transform: investingExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 200ms ease',
                    flexShrink: 0,
                  }}
                  aria-hidden
                />
              </button>
              {investingExpanded && (
                <div id="investing-list">
                  {investingCommitments.map((c, i) => (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        padding: '12px 16px',
                        borderBottom: i < investingCommitments.length - 1 ? '0.5px solid rgba(0,0,0,0.07)' : 'none',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: '#1A1A1A', fontWeight: 500, lineHeight: 1.3 }}>
                          {c.label}
                        </div>
                        <div style={{ fontSize: 11, color: '#888780', marginTop: 2, lineHeight: 1.3 }}>
                          {[c.category, c.frequency].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, color: '#1A1A1A', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                        {formatRupeesIndian(c.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {/* Your rules — schema-backed since D.49 (Stream 0.5t piece #4).
            Safety net (renamed from "buffer floor" per D.48) + impulse-wait
            threshold + hours + daily SPS floor on profiles row. Profile
            still read-only; edit affordance V2. */}
        <ProfileSectionHeader title="Your rules" />
        <Card className="!p-0">
          <ProfileFieldRow
            label="Safety net"
            value={formatSafetyNet(userRules.safety_net)}
            onClick={showStub}
          />
          <ProfileFieldRow
            label="Impulse purchase wait"
            value={formatImpulseWait(userRules.impulse_wait_threshold, userRules.impulse_wait_hours)}
            onClick={showStub}
          />
          <ProfileFieldRow
            label="Avatar"
            value={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                {identityShortLabel}
                <span style={{ color: '#0C447C', fontWeight: 500, fontSize: 13 }}>Change</span>
              </span>
            }
            onClick={showStub}
            isLast
          />
        </Card>

        {/* Disclaimer — full body + acknowledged date */}
        <ProfileSectionHeader title="Disclaimer" />
        <Card>
          <div style={{ fontSize: 12.5, color: '#5F5E5A', lineHeight: 1.55 }}>
            {DISCLAIMER_BODY}
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: '#888780',
              marginTop: 10,
              paddingTop: 10,
              borderTop: '0.5px solid rgba(0,0,0,0.07)',
            }}
          >
            Acknowledged on {formatDateLong(ackDateRaw)}
          </div>
        </Card>

        {/* For reviewers — navy callout introducing the Reviewer Console.
            JSX preview lines 844-858. */}
        <div
          style={{
            marginTop: 24,
            padding: '14px 16px',
            backgroundColor: '#DCEEFF',
            borderRadius: 18,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: '#0C447C',
              fontWeight: 500,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            For reviewers
          </div>
          <div style={{ fontSize: 12, color: '#0C447C', lineHeight: 1.5, opacity: 0.85 }}>
            This is a portfolio demo running on a single seeded user (Priya). The affordances below let you experience parts of the product that are normally event-triggered, plus stubs for case-study artifacts.
          </div>
        </div>

        {/* Reviewer Console — functional resets (existing) + presentational stubs */}
        <div style={{ marginTop: 10 }}>
          <ReviewerConsole onStub={showStub} />
        </div>

        {/* About */}
        <ProfileSectionHeader title="About Savio" />
        <Card className="!p-0">
          <ProfileFieldRow label="Version" value="0.3.0 (Demo MVP)" isLast />
        </Card>

        {/* D.21 (Stream 0.5p #1) — sign out. Utility action, not a featured
            destructive button — single understated row at the bottom of the
            page. Navigate to / after sign-out succeeds; the auth-gate (D.17)
            doesn't fire post-logout because no session is present, so the
            Welcome screen renders normally. */}
        <div style={{ marginTop: 24, marginBottom: 4 }}>
          <button
            type="button"
            onClick={async () => {
              try {
                await logoutFromPriya();
                navigate('/', { replace: true });
              } catch (err) {
                setSnackMessage('Sign out failed — please try again.');
                console.error('[profile] logout failed', err);
              }
            }}
            className="w-full hover:bg-black/[0.02] transition-colors"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '14px 16px',
              backgroundColor: 'transparent',
              border: '0.5px solid rgba(0,0,0,0.10)',
              borderRadius: 999,
              fontSize: 13.5,
              color: '#5F5E5A',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <LogOut size={14} strokeWidth={2} />
            Sign out
          </button>
        </div>

        {/* Footer */}
        <div
          style={{
            textAlign: 'center',
            padding: '32px 0 24px',
            fontSize: 11,
            color: '#888780',
          }}
        >
          Built with care · Bengaluru, 2026
        </div>
      </div>

      <Snackbar message={snackMessage} onDismiss={dismissSnack} />

      <BottomNav />
    </div>
  );
}
