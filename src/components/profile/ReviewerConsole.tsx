import { Download, FileText, Beaker, ChevronRight, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, SectionHeader } from '../primitives';
import { ResetActionRow } from './ResetActionRow';
import { resetAprilRitual, clearChatHistory, resetReflectionsToSeed, resetEntireDemoState } from '../../lib/reviewer-actions';
import { getPreviousMonthName } from '../../lib/dates';

/**
 * Reviewer Console — Phase B1 expanded version.
 *
 * Layer 1: functional resets (Phase 3.5 era). Reset the previous-month ritual,
 * clear chat history, restore reflections to the seeded set. These actually
 * mutate DB state via RPC.
 *
 * Layer 2: presentational case-study links (Phase B1 add). View seed CSV,
 * Read case study, View divergence tests. These show portfolio reviewers
 * what the case study contains even when the artifacts aren't wired up.
 * onStub callback fires the parent's snackbar.
 *
 * Visual separation: existing reset card on top (with confirm-tap UX),
 * then the presentational links card below.
 */
type Props = {
  /** Called when a presentational stub is tapped. Parent shows a snackbar. */
  onStub?: () => void;
};

type StubRowProps = {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  sublabel: string;
  onClick: () => void;
  isLast?: boolean;
};

function StubRow({ icon: Icon, label, sublabel, onClick, isLast }: StubRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-black/[0.02] transition-colors"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        borderBottom: isLast ? 'none' : '0.5px solid rgba(0,0,0,0.07)',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          backgroundColor: '#F4F4F2',
          color: '#5F5E5A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={15} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: '#1A1A1A', lineHeight: 1.2 }}>{label}</div>
        <div style={{ fontSize: 11.5, color: '#888780', marginTop: 2 }}>{sublabel}</div>
      </div>
      <ChevronRight size={16} className="text-[#888780] flex-shrink-0" />
    </button>
  );
}

export function ReviewerConsole({ onStub }: Props) {
  const prevMonth = getPreviousMonthName();
  const handleStub = onStub ?? (() => {});
  // D.62 (Stream 0.5v piece #5) — navigation hook for the March
  // close-out preview link below. The route accepts any month string;
  // seed has March pre-arranged to land negative so reviewers can see
  // the "What you can do now" deficit_safe guidance tier without
  // having to wait for a real deficit to occur.
  const navigate = useNavigate();

  return (
    <>
      {/* Layer 1 — functional resets */}
      <Card>
        <SectionHeader title="Reviewer tools" variant="uppercase" />

        <p className="text-sm text-[#5F5E5A] leading-relaxed mb-4">
          These let you re-experience Savio&rsquo;s flows by resetting state to
          demo-ready conditions. Dev-only in spirit; visible by design so portfolio
          reviewers can replay a ritual, clear chat, or restore reflections.
        </p>

        <div>
          <ResetActionRow
            title={`Reset ${prevMonth} ritual`}
            description={`Returns ${prevMonth}'s monthly ritual to pending state. The check-in banner reappears on Home, the linked goal balance reverts, and the rollover allocation row is deleted.`}
            buttonLabel="Reset"
            confirmCopy={`This will undo ${prevMonth}'s rollover allocation. Your goal balance reverts to its pre-ritual value. Continue?`}
            onConfirm={resetAprilRitual}
          />

          <ResetActionRow
            title="Clear chat history"
            description="Removes all chat messages for your account. The Edge Function and grounding context aren&rsquo;t affected — only the conversation log."
            buttonLabel="Clear"
            confirmCopy="This deletes every chat message in your history. The next conversation starts fresh. Continue?"
            onConfirm={clearChatHistory}
          />

          <ResetActionRow
            title="Restore reflection labels"
            description="Restores reflections to the seeded set (the 18 historical labels behind the Amazon/Myntra/Zara trend stories). Labels you added during demo iteration will be cleared."
            buttonLabel="Restore"
            confirmCopy="Reflections added during this session will be deleted. The 18 seeded reflections come back. Continue?"
            onConfirm={resetReflectionsToSeed}
          />

          <ResetActionRow
            title="Reset entire demo state"
            description="Wipes chat, windfall allocations, May ritual, saved decisions, and restores reflections to seed in one shot. Skips the 60-minute auto-reset cooldown. Use between portfolio reviews to guarantee a fresh starting state."
            buttonLabel="Reset"
            confirmCopy="This wipes chat history, windfall lock-ins, May ritual, saved decisions, and any reflection labels added during this session. The auto-reset cooldown timer also resets. Continue?"
            onConfirm={resetEntireDemoState}
          />
        </div>
      </Card>

      {/* Layer 2 — presentational case-study links */}
      <div style={{ marginTop: 10 }}>
        <Card className="!p-0">
          <StubRow
            icon={Download}
            label="View seed data CSV"
            sublabel="Priya's 352 transactions, 13 commitments, 9 reflections"
            onClick={handleStub}
          />
          <StubRow
            icon={FileText}
            label="Read the case study"
            sublabel="What I built and why — full PM writeup"
            onClick={handleStub}
          />
          <StubRow
            icon={Beaker}
            label="View divergence tests"
            sublabel="Architectural changes from the team v1 build"
            onClick={handleStub}
          />
          {/* D.62 (Stream 0.5v #5) — March close-out preview. Canonical
              April is positive post-D.47; March is seeded with extra
              one-off purchases to land at ~₹10K deficit, exercising the
              "What you can do now" deficit_safe tier (safety net still
              intact). Navigates via the same /ritual/:month route the
              ritual banner uses — the close-out screen renders fine for
              past months, the Continue button routes to /complete for
              negative leftovers. */}
          <StubRow
            icon={AlertTriangle}
            label="Preview March close-out (deficit demo)"
            sublabel="See the &lsquo;What you can do now&rsquo; guidance tier for a negative month"
            onClick={() => navigate('/ritual/2026-03')}
            isLast
          />
        </Card>
      </div>
    </>
  );
}
