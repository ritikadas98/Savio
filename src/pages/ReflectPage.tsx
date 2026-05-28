import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BottomNav } from '../components/layout/BottomNav';
import { Card } from '../components/primitives';
import { Snackbar } from '../components/profile/Snackbar';
import { UnlabeledTxCard, type UnlabeledTxLike } from '../components/reflect/UnlabeledTxCard';
import { getMerchantIcon } from '../lib/merchant-icons';
import { daysAgo, today } from '../lib/dates';
import { fetchAllReflections, derivePatterns, type Pattern, type ReflectionWithTx } from '../lib/reflect-patterns';
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

  // Stream 0.5j — AI-synthesized patterns + rule-engine fallback. `patterns`
  // is null while loading (so we don't flash the rule-engine output before
  // the AI call resolves on first mount). `patternsSource` drives the ✨
  // sparkles affordance — only shown when the surface is AI-derived.
  const [patterns, setPatterns] = useState<Pattern[] | null>(null);
  const [patternsSource, setPatternsSource] = useState<'ai' | 'rule_engine' | null>(null);

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

  // Stream 0.5j — synthesize patterns whenever the reflection set changes.
  // Path: try Edge Function (cache-aware), fall back to local rule engine
  // on any failure. Setting patterns + source together avoids a flash of
  // mismatched sparkles state.
  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('synthesize-patterns', { body: {} });
        if (cancelled) return;
        if (error || !data || data.error || !Array.isArray(data.patterns)) {
          throw new Error(error?.message ?? data?.error ?? 'invalid response');
        }
        // Empty-array result from the function (no reflections yet) — defer
        // to the rule engine's empty-state copy so the user sees a useful
        // hint instead of nothing.
        if (data.patterns.length === 0) {
          const rule = derivePatterns(reflections);
          setPatterns(rule);
          setPatternsSource('rule_engine');
          return;
        }
        setPatterns(data.patterns);
        setPatternsSource(data.source === 'ai' ? 'ai' : 'rule_engine');
      } catch (err) {
        console.warn('[ReflectPage] AI patterns failed, falling back to rule engine', err);
        if (cancelled) return;
        const rule = derivePatterns(reflections);
        setPatterns(rule);
        setPatternsSource('rule_engine');
      }
    })();
    return () => { cancelled = true; };
  }, [profileId, reflections]);

  // Stream 0.5j-fix2 — manual refresh affordance next to "Across your
  // reflections". Reuses forceResynthesizePatterns; bypasses the 24-hour
  // cache via the Edge Function's force_refresh path. Single tap, no
  // confirmation — refresh is neither destructive nor expensive enough.
  // Disabled while loading via `patterns === null` semantic.
  const handleManualRefresh = useCallback(async () => {
    if (patterns === null) return;  // already mid-flight
    setPatterns(null);
    try {
      const result = await forceResynthesizePatterns();
      const fresh = result.patterns ?? [];
      if (fresh.length === 0) {
        const rule = derivePatterns(reflections);
        setPatterns(rule);
        setPatternsSource('rule_engine');
        return;
      }
      setPatterns(fresh);
      setPatternsSource(result.source ?? 'ai');
    } catch (err) {
      console.warn('[ReflectPage] manual refresh failed, falling back to rule engine', err);
      const rule = derivePatterns(reflections);
      setPatterns(rule);
      setPatternsSource('rule_engine');
    }
  }, [patterns, reflections]);

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
  const hasUnlabeled = visibleTxs.length > 0;

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
        {/* Labeling intro — only when there's something to label */}
        {!loading && hasUnlabeled && (
          <p style={{ fontSize: 14, color: '#5F5E5A', lineHeight: 1.5, padding: '4px 6px 14px', margin: 0 }}>
            Tap how each felt — labels help Savio understand your patterns over time.
          </p>
        )}

        {/* Unlabeled transactions list OR empty-state card */}
        {loading ? (
          <div className="flex justify-center" style={{ padding: '24px 0' }}>
            <div className="w-6 h-6 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : hasUnlabeled ? (
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

        {/* Labeling footer — only when labeling list rendered */}
        {!loading && hasUnlabeled && (
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

        {/* Divider between halves */}
        <div
          style={{
            borderTop: '0.5px solid rgba(0,0,0,0.07)',
            margin: '28px -6px 20px',
            opacity: 0.6,
          }}
        />

        {/* D.23 (Stream 0.5p piece #3) — patterns header.
            Pre-0.5p: always-visible ↻ refresh icon (0.5j-fix2). Real-user
            testing surfaced that it read as "something broke, refresh it"
            — repair framing rather than reward. Reframed: when all
            reflections are labeled (no unlabeled remaining), surface a
            "Generate reflection" CTA that frames the synthesis as earned.
            When unlabeled items remain, the affordance is hidden —
            labeling is the user's actual job. After tap, button stays
            enabled (option c) so users can regenerate if they want.
            Sparkles icon retained — signals AI source. */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 6px 12px',
          }}
        >
          <span style={{ fontSize: 13, color: '#5F5E5A', fontWeight: 500 }}>
            Across your reflections
          </span>
          {patternsSource === 'ai' && (
            <span title="Patterns synthesized by Savio's AI." style={{ display: 'inline-flex', color: '#5F5E5A' }}>
              <Sparkles size={14} strokeWidth={2} />
            </span>
          )}
          {!hasUnlabeled && (
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={patterns === null}
              aria-label="Generate insight"
              title="Re-synthesize patterns from your current labels"
              style={{
                marginLeft: 'auto',
                // 0.5p mid-stream update: locked color is sage #B2EF82 with
                // dark green #173404 text (was the lighter #DEF2CB pair).
                // Brighter sage reads as reward against the green canvas;
                // dark-on-bright text holds AA contrast comfortably.
                background: '#B2EF82',
                color: '#173404',
                border: 'none',
                padding: '6px 12px',
                borderRadius: 999,
                cursor: patterns === null ? 'not-allowed' : 'pointer',
                opacity: patterns === null ? 0.55 : 1,
                fontFamily: 'inherit',
                fontSize: 11.5,
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                transition: 'opacity 150ms ease',
              }}
            >
              <Sparkles size={11} strokeWidth={2.2} />
              {patterns === null ? 'Generating…' : 'Generate insight'}
            </button>
          )}
        </div>

        {patterns === null ? (
          <Card style={{ padding: '16px 18px' }}>
            <div className="flex items-center gap-3" style={{ color: '#888780', fontSize: 13 }}>
              <div className="w-4 h-4 border-2 border-[#888780] border-t-transparent rounded-full animate-spin" />
              Finding patterns…
            </div>
          </Card>
        ) : (
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
      </div>

      <Snackbar message={snackMessage} onDismiss={dismissSnack} />
      <BottomNav />
    </div>
  );
}
