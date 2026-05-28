import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Compass, Sailboat, Hammer, ChevronRight, LogOut, type LucideIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BottomNav } from '../components/layout/BottomNav';
import { ReviewerConsole } from '../components/profile/ReviewerConsole';
import { Card, Pill } from '../components/primitives';
import { Snackbar } from '../components/profile/Snackbar';
import { formatRupeesIndian, ordinalSuffix, formatDateLong } from '../lib/formatters';
import { DEMO_MODE_MESSAGE } from '../lib/copy';
import { logoutFromPriya } from '../lib/auth';

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
  label: string;
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
        .select('id, full_name, avatar, life_stage, monthly_income_net, anchor_day_of_month, primary_bank, disclaimer_acknowledged_at')
        .eq('auth_user_id', user.id)
        .single();
      if (cancelled || !profileRow) return;
      setProfile(profileRow as ProfileRow);

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
    })();
    return () => { cancelled = true; };
  }, []);

  const commitmentTotal = commitments.reduce((sum, c) => sum + c.amount, 0);

  const income = profile?.monthly_income_net ?? 68500;
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

        {/* Your finances */}
        <ProfileSectionHeader title="Your finances" />
        <Card className="!p-0">
          <ProfileFieldRow
            label="Monthly income"
            value={`${formatRupeesIndian(income)} net`}
            onClick={showStub}
          />
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

        {/* D.31 (Stream 0.5q piece #2) — Your commitments. Fixed-only,
            read-only. Variable categories (Groceries / Eating out /
            Transport) shown in close-out screen 1 and ritual flow, not
            here. No edit affordance yet — V2 work. */}
        {commitments.length > 0 && (
          <>
            <ProfileSectionHeader title="Your commitments" />
            <Card className="!p-0">
              {commitments.map(c => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '12px 16px',
                    borderBottom: '0.5px solid rgba(0,0,0,0.07)',
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(0,0,0,0.02)',
                }}
              >
                <span style={{ flex: 1, fontSize: 13, color: '#5F5E5A', fontWeight: 500 }}>
                  Monthly total
                </span>
                <span style={{ fontSize: 14, color: '#1A1A1A', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                  {formatRupeesIndian(commitmentTotal)}
                </span>
              </div>
            </Card>
          </>
        )}

        {/* Your rules — buffer_floor + impulse_threshold not yet in schema;
            hardcoded for MVP demo. V2 adds columns + edit flow. */}
        <ProfileSectionHeader title="Your rules" />
        <Card className="!p-0">
          <ProfileFieldRow
            label="Buffer floor"
            value={formatRupeesIndian(100000)}
            onClick={showStub}
          />
          <ProfileFieldRow
            label="Impulse purchase wait"
            value="48 hrs over ₹3K"
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
