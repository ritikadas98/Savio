import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BottomNav } from '../components/layout/BottomNav';
import { Card } from '../components/primitives';
import { Snackbar } from '../components/profile/Snackbar';
import { UnlabeledTxCard, type UnlabeledTxLike } from '../components/reflect/UnlabeledTxCard';
import { getMerchantIcon } from '../lib/merchant-icons';
import { daysAgo, today } from '../lib/dates';
import { fetchAllReflections, derivePatterns, computeMerchantTrends, type Pattern, type ReflectionWithTx } from '../lib/reflect-patterns';
import { MerchantTrendCard } from '../components/reflect/MerchantTrendCard';
import { forceResynthesizePatterns } from '../lib/reviewer-actions';
import type { ReflectionLabel } from '../lib/mood';

// Phase B2 (v2 hybrid):
//   Top half: labeling surface per JSX preview lines 596-660 — show up to 8
//   unlabeled debit transactions from the last 30 days, let user label each
//   inline. Optimistic UI; revert on insert failure.
//   Bottom half: patterns section (Across your reflections) — derived
//   insights from the full reflection history. Deliberate extension beyond
//   JSX preview; case-study payoff is "All 4 Myntra purchases marked regret"
//   type patterns surfacing naturally from seed.

const UNLABELED_WINDOW_DAYS = 30;
const UNLABELED_VISIBLE_LIMIT = 8;

// Stream 0.5f: silent regret-reflection threshold. Reflect is for deliberate
// discretionary purchases worth reflecting on, not routine micro-spend
// (Blinkit, UPI, small daily rides). Below this floor, labeling adds noise
// without insight. No user-facing copy — threshold filters silently. MVP
// hardcoded; V2 exposes via user_profile.regret_threshold_amount. Strictly
// greater (not ≥) so the ₹1,000 boundary excludes the fixed Maid/Helper
// commitment which is recurring, not a decision moment.
const UNLABELED_AMOUNT_FLOOR = 1000;

// D.32 (Stream 0.5q piece #6) — Generate Reflections loading state.
// Phrases cycle while AI synthesizes. Each visible ~1.8s with a CSS
// fade-in keyframe rerunning per phrase via React's key prop. The copy
// resists generic spinner UX — narrates what the AI is doing in human
// language, the same discipline as C.16 (three-step prose labels) and
// C.26 (verdict action language).
const LOADING_PHRASES = [
  'Pondering your reflections…',
  'Thinking through your patterns…',
  'Synthesizing…',
  'Almost done…',
];
const LOADING_PHRASE_INTERVAL_MS = 1800;

// D.36 (Stream 0.5r piece #4) — minimum loading display duration. Without
// this, AI synthesis on a warm Vertex isolate can return in under a second
// and the rotating phrases flash + disappear before the user can read
// them. Four seconds is long enough to see ~2 phrases and anchors the
// loading moment as intentional UX rather than glitchy state-change.
const MIN_LOADING_MS = 4000;

// Local view-state extension on the fetched transaction row. Tracks the
// optimistic label so the row can render labeled-pill UI before the DB write
// confirms.
type ViewTx = UnlabeledTxLike & {
  label: ReflectionLabel | null;
  pending: boolean;
};

async function fetchUnlabeledRecent(userId: string): Promise<UnlabeledTxLike[]> {
  const cutoff = daysAgo(UNLABELED_WINDOW_DAYS).toISOString();
  const todayIso = today().toISOString();

  // Two-query approach because Supabase's .is('reflection', null) on a joined
  // relation doesn't filter cleanly. Fetch transactions + reflections in
  // parallel, subtract client-side.
  const [{ data: txs }, { data: refs }] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, merchant, category, amount, occurred_at')
      .eq('user_id', userId)
      .eq('direction', 'debit')
      .gt('amount', UNLABELED_AMOUNT_FLOOR)
      // Stream 0.5g revision: commitment_id filter intentionally NOT applied.
      // The case-study story is "structural filter catches ~90%, user agency
      // handles the residual." Leaving commitment-linked txns visible (BESCOM,
      // Star Health, SIPs, eating-out variable-linked) gives the X-icon
      // dismiss affordance from 0.5g-B something concrete to demonstrate.
      .gte('occurred_at', cutoff)
      .lte('occurred_at', todayIso)
      .order('occurred_at', { ascending: false }),
    supabase
      .from('reflections')
      .select('transaction_id')
      .eq('user_id', userId),
  ]);

  const labeled = new Set((refs ?? []).map((r: { transaction_id: string }) => r.transaction_id));
  return (txs ?? [])
    .filter(t => !labeled.has(t.id))
    .slice(0, UNLABELED_VISIBLE_LIMIT) as UnlabeledTxLike[];
}

export function ReflectPage() {
  const navigate = useNavigate();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [viewTxs, setViewTxs] = useState<ViewTx[]>([]);
  const [reflections, setReflections] = useState<ReflectionWithTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackMessage, setSnackMessage] = useState<string | null>(null);
  const dismissSnack = useCallback(() => setSnackMessage(null), []);

  // Stream 0.5j — AI-synthesized patterns + rule-engine fallback. After
  // D.32 (Stream 0.5q piece #6), patterns are no longer auto-synthesized
  // on mount — `hasGeneratedThisSession` gates the entire section render
  // and `handleGenerate` (sticky button tap) is the only trigger. The
  // patternsSource (`ai` vs `rule_engine`) signal that drove the inline
  // Sparkles affordance was dropped in 0.5q: the sticky button now owns
  // the AI-synthesis surface.
  const [patterns, setPatterns] = useState<Pattern[] | null>(null);

  // D.32 — per-session "user has tapped Generate Reflections at least once"
  // flag. Patterns + trend section only render when true. Auto-reset (D.15)
  // clears it naturally on the next session via component unmount.
  const [hasGeneratedThisSession, setHasGeneratedThisSession] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);

  // Stream 0.5g-C: session-only dismissed-tx state. Reset on component unmount
  // (navigation away and back). No localStorage — production Savio would
  // persist via a reflect_dismissed_transactions table; MVP keeps it simple.
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const handleDismiss = useCallback((txId: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(txId);
      return next;
    });
  }, []);

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
      const pid = profile.id as string;

      const [unlabeled, refs] = await Promise.all([
        fetchUnlabeledRecent(pid),
        fetchAllReflections(pid),
      ]);
      if (cancelled) return;
      setProfileId(pid);
      setViewTxs(unlabeled.map(t => ({ ...t, label: null, pending: false })));
      setReflections(refs);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // D.32 — phrase-rotation effect, runs only while AI synthesis is in
  // flight. Cycles through LOADING_PHRASES on a fixed interval; React's
  // key={loadingPhraseIndex} on the rendered text restarts the CSS fade-in
  // animation per phrase. Index loops back to 0 if AI takes longer than
  // (phrases × interval), so the user always sees motion. Phrase index
  // resets to 0 inside handleGenerate (not here) to avoid synchronous
  // setState in this effect.
  useEffect(() => {
    if (!generating) return;
    const id = window.setInterval(() => {
      setLoadingPhraseIndex(i => (i + 1) % LOADING_PHRASES.length);
    }, LOADING_PHRASE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [generating]);

  // D.32 — Generate Reflections handler. Sticky bottom button's tap target.
  // Sequence: enter loading state → invoke Edge Function (cache-bypassing
  // via forceResynthesizePatterns from 0.5j-fix2 era) → on success, set
  // patterns + flip hasGeneratedThisSession so the trend + patterns section
  // becomes visible. Rule-engine fallback preserves a useful result if the
  // Edge Function fails or returns empty.
  const handleGenerate = useCallback(async () => {
    if (generating) return;
    setLoadingPhraseIndex(0);
    setGenerating(true);
    setPatterns(null);
    const startedAt = Date.now();
    // D.36 (Stream 0.5r piece #4) — Promise.all race ensures the loading
    // state is visible for at least MIN_LOADING_MS even when AI returns
    // fast (warm Vertex isolates can return in <1s). The min-delay promise
    // runs in parallel with the AI call, so user-perceived loading time
    // is max(ai_latency, MIN_LOADING_MS) — whichever wins.
    const minDelay = new Promise<void>(resolve => setTimeout(resolve, MIN_LOADING_MS));
    try {
      const [result] = await Promise.all([forceResynthesizePatterns(), minDelay]);
      const fresh = result.patterns ?? [];
      if (fresh.length === 0) {
        const rule = derivePatterns(reflections);
        setPatterns(rule);
      } else {
        setPatterns(fresh);
      }
      setHasGeneratedThisSession(true);
    } catch (err) {
      console.warn('[ReflectPage] generate failed, falling back to rule engine', err);
      // D.36 — respect MIN_LOADING_MS on the error path too, so an error
      // doesn't flash on screen for <1s. Compute remaining delay against
      // actual elapsed time.
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_LOADING_MS) {
        await new Promise(resolve => setTimeout(resolve, MIN_LOADING_MS - elapsed));
      }
      const rule = derivePatterns(reflections);
      setPatterns(rule);
      setHasGeneratedThisSession(true);
    } finally {
      setGenerating(false);
    }
  }, [generating, reflections]);

  const refreshReflections = useCallback(async () => {
    if (!profileId) return;
    // Stream 0.5j-fix — invalidate the patterns cache BEFORE updating
    // `reflections`. setReflections schedules a re-render that fires the
    // patterns effect; if invalidate hasn't completed server-side yet, the
    // Edge Function reads the still-fresh cache row and returns stale
    // patterns. Awaiting invalidate first guarantees the cache is gone
    // before the effect can re-read it. Best-effort: a network failure on
    // invalidate is non-fatal — the user still sees patterns based on
    // their previous label, just one beat behind.
    await supabase.rpc('invalidate_patterns_cache').catch(() => { /* non-fatal */ });
    const refs = await fetchAllReflections(profileId);
    setReflections(refs);
  }, [profileId]);

  const handleLabel = useCallback(async (txId: string, label: ReflectionLabel) => {
    if (!profileId) return;
    // Optimistic: mark labeled + pending
    setViewTxs(prev => prev.map(t => t.id === txId ? { ...t, label, pending: true } : t));
    const { error } = await supabase.from('reflections').insert({
      user_id: profileId,
      transaction_id: txId,
      label,
    });
    if (error) {
      // Revert
      setViewTxs(prev => prev.map(t => t.id === txId ? { ...t, label: null, pending: false } : t));
      setSnackMessage('Label failed. Try again.');
      return;
    }
    setViewTxs(prev => prev.map(t => t.id === txId ? { ...t, pending: false } : t));
    refreshReflections();
  }, [profileId, refreshReflections]);

  const handleUndo = useCallback(async (txId: string) => {
    if (!profileId) return;
    setViewTxs(prev => prev.map(t => t.id === txId ? { ...t, label: null, pending: true } : t));
    const { error } = await supabase
      .from('reflections')
      .delete()
      .eq('user_id', profileId)
      .eq('transaction_id', txId);
    if (error) {
      setSnackMessage('Undo failed. Try again.');
    }
    setViewTxs(prev => prev.map(t => t.id === txId ? { ...t, pending: false } : t));
    refreshReflections();
  }, [profileId, refreshReflections]);

  const visibleTxs = viewTxs.filter(t => !dismissedIds.has(t.id));
  // D.32 fix — previously `hasUnlabeled = visibleTxs.length > 0` gated
  // the section header + Generate insight button. That was wrong: it
  // stayed true after all items were labeled (labeled rows remain in the
  // view list with their labeled-pill UI), so the button never appeared.
  // Real semantic: "any unlabeled item still pending action."
  const hasTransactions = visibleTxs.length > 0;
  const hasAnyUnlabeled = visibleTxs.some(t => t.label === null);
  const allLabeled = hasTransactions && !hasAnyUnlabeled;

  // B.18 — per-merchant trend computation. Derived from reflections via
  // Path B (occurred_at bucketing). Memoized so React-Strict double-mounts
  // don't re-bucket on every render.
  const merchantTrends = useMemo(() => computeMerchantTrends(reflections), [reflections]);

  return (
    <div className="flex flex-col h-full bg-[#E4ECE6]">
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
          Reflect
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-6">
        {/* Labeling intro — only when there's still something unlabeled */}
        {!loading && hasAnyUnlabeled && (
          <p style={{ fontSize: 14, color: '#5F5E5A', lineHeight: 1.5, padding: '4px 6px 14px', margin: 0 }}>
            Tap how each felt — labels help Savio understand your patterns over time.
          </p>
        )}

        {/* Unlabeled transactions list OR empty-state card */}
        {loading ? (
          <div className="flex justify-center" style={{ padding: '24px 0' }}>
            <div className="w-6 h-6 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : hasTransactions ? (
          visibleTxs.map(tx => (
            <UnlabeledTxCard
              key={tx.id}
              tx={tx}
              label={tx.label}
              pending={tx.pending}
              merchantIconFor={getMerchantIcon}
              onLabel={(label) => handleLabel(tx.id, label)}
              onUndo={() => handleUndo(tx.id)}
              onDismiss={() => handleDismiss(tx.id)}
            />
          ))
        ) : (
          <Card>
            <div style={{ textAlign: 'center', padding: '12px 4px' }}>
              <div style={{ fontSize: 14, color: '#1A1A1A', marginBottom: 6 }}>
                All caught up.
              </div>
              <div style={{ fontSize: 12.5, color: '#5F5E5A', lineHeight: 1.45 }}>
                Nothing to label right now. Check back after new transactions land.
              </div>
            </div>
          </Card>
        )}

        {/* Labeling footer — only when there's still unlabeled work to do */}
        {!loading && hasAnyUnlabeled && (
          <div style={{
            fontSize: 12,
            color: '#888780',
            textAlign: 'center',
            padding: '14px 6px 4px',
            lineHeight: 1.45,
          }}>
            Reflections train Savio&rsquo;s regret-rate signal. No reminders, no nags.
          </div>
        )}

        {/* D.32 — patterns / trend section, gated on hasGeneratedThisSession.
            User must tap the sticky Generate Reflections button at least
            once per session before this surface appears. Auto-reset (D.15)
            clears the flag naturally on the next session. */}
        {hasGeneratedThisSession && (
          <>
            <div
              style={{
                borderTop: '0.5px solid rgba(0,0,0,0.07)',
                margin: '28px -6px 20px',
                opacity: 0.6,
              }}
            />

            {/* B.18 — per-merchant trend section header (kept; sticky
                button now carries the AI-synthesis affordance). */}
            <div style={{ padding: '0 6px 8px' }}>
              <div style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 500, lineHeight: 1.3 }}>
                Regret rate change by merchant
              </div>
              <div style={{ fontSize: 10, color: '#5A6B5F', marginTop: 1, lineHeight: 1.3 }}>
                Recent purchases vs prior 3 months
              </div>
            </div>

            {merchantTrends.length > 0 ? (
              <div style={{ padding: '0 0 12px' }}>
                {merchantTrends.map(t => (
                  <MerchantTrendCard key={t.merchant} trend={t} />
                ))}
              </div>
            ) : (
              <Card style={{ padding: 18, textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#5A6B5F', fontStyle: 'italic' }}>
                  No merchant patterns yet. Label a few more transactions to start seeing trends.
                </div>
              </Card>
            )}

            {patterns && patterns.length > 0 && (
              <Card style={{ padding: '16px 18px' }}>
                {patterns.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      paddingBottom: i < patterns.length - 1 ? 14 : 0,
                      marginBottom: i < patterns.length - 1 ? 14 : 0,
                      borderBottom: i < patterns.length - 1 ? '0.5px solid rgba(0,0,0,0.07)' : 'none',
                    }}
                  >
                    <div style={{ fontSize: 13.5, color: '#1A1A1A', lineHeight: 1.45 }}>
                      <strong style={{ fontWeight: 500, color: '#0C447C' }}>{p.label}</strong>{' '}
                      {p.body}
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}
      </div>

      {/* D.32 — sticky "Show my reflections" button. Sits above BottomNav
          via the flex-shrink-0 order in the parent column. Three states:
          DISABLED (any unlabeled), ENABLED (allLabeled), LOADING (in
          synthesis). Loading state replaces the label with rotating
          phrases keyed by loadingPhraseIndex so each phrase re-runs the
          CSS fade-in animation.
          D.33/D.34/D.35 (Stream 0.5r) — button restyled (sage #78A353),
          label changed to "Show my reflections", and a state-aware
          discovery hint rendered below in DISABLED + pre-tap ENABLED. */}
      <GenerateReflectionsButton
        state={generating ? 'loading' : allLabeled ? 'enabled' : 'disabled'}
        hasGenerated={hasGeneratedThisSession}
        phraseIndex={loadingPhraseIndex}
        onTap={handleGenerate}
      />

      <Snackbar message={snackMessage} onDismiss={dismissSnack} />
      <BottomNav />
    </div>
  );
}

// D.32 — sticky bottom button component. State machine:
//   disabled — light gray, no tap (user still has unlabeled items)
//   enabled  — vivid green (#66C22D per D.33 Stream 0.5r), Sparkles + label
//   loading  — vivid green, rotating LOADING_PHRASES with fade animation
//
// D.33 (Stream 0.5r piece #1) — ENABLED background iterated from the
// original #B2EF82 (read as "candy") through #78A353 (too muted) to
// #66C22D (vivid, decisive). Text color #173404 unchanged.
// D.34 (Stream 0.5r piece #2) — label "Generate Reflections" → "Show my
// reflections" (possessive, user-centric, resists LLM-default "Generate X").
// D.35 (Stream 0.5r piece #3) — state-aware discovery hint below the
// button bridges the "all labeled" → "trends appear" gap.
type ButtonState = 'disabled' | 'enabled' | 'loading';

function GenerateReflectionsButton({
  state,
  hasGenerated,
  phraseIndex,
  onTap,
}: {
  state: ButtonState;
  hasGenerated: boolean;
  phraseIndex: number;
  onTap: () => void;
}) {
  const isLoading = state === 'loading';
  const isEnabled = state === 'enabled';
  const isDisabled = state === 'disabled';

  const bg = isDisabled ? '#F1EFE8' : '#66C22D';
  const fg = isDisabled ? '#888880' : '#173404';
  const cursor = isLoading ? 'wait' : isEnabled ? 'pointer' : 'not-allowed';

  // D.35 — hint visibility. Hidden during LOADING (rotating phrases own
  // the moment) and POST-GENERATION (patterns visible above). State-aware
  // copy in the two pre-generation states.
  const showHint = !isLoading && !hasGenerated;
  const hintText = isDisabled
    ? 'Label all spending first · Trend patterns appear after'
    : 'See trends after generation';

  return (
    <div
      className="flex-shrink-0"
      style={{
        padding: '10px 16px 6px',
        backgroundColor: '#E4ECE6',
      }}
    >
      <button
        type="button"
        onClick={isEnabled ? onTap : undefined}
        disabled={!isEnabled}
        aria-label="Show my reflections"
        style={{
          width: '100%',
          background: bg,
          color: fg,
          border: 'none',
          padding: '14px 18px',
          borderRadius: 999,
          cursor,
          fontFamily: 'inherit',
          fontSize: 14.5,
          fontWeight: 500,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          transition: 'background-color 200ms ease, color 200ms ease',
          minHeight: 48,
        }}
      >
        <Sparkles size={15} strokeWidth={2.2} />
        {isLoading ? (
          <span
            key={phraseIndex}
            style={{
              animation: 'savio-fade-in-out 1.8s ease-in-out',
              display: 'inline-block',
            }}
          >
            {LOADING_PHRASES[phraseIndex]}
          </span>
        ) : (
          <span>Show my reflections</span>
        )}
      </button>
      {showHint && (
        <div
          style={{
            fontSize: 11,
            color: '#5A6B5F',
            textAlign: 'center',
            marginTop: 8,
            lineHeight: 1.3,
          }}
        >
          {hintText}
        </div>
      )}
      {/* keyframes inlined here so the component is self-contained */}
      <style>{`
        @keyframes savio-fade-in-out {
          0%   { opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
