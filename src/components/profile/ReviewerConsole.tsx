import React from 'react';
import { Card, SectionHeader } from '../primitives';
import { ResetActionRow } from './ResetActionRow';
import { resetAprilRitual, clearChatHistory, resetReflectionsToSeed } from '../../lib/reviewer-actions';

/**
 * Reviewer Console — Phase 3.5 minimal version.
 *
 * Three demo affordances surfaced as a real product section (not a hidden
 * dev tool). The framing: "These let reviewers re-experience Savio's flows
 * by resetting demo state without touching the underlying seed."
 *
 * Phase 4's full Profile page will absorb this as a collapsible section;
 * for now it's the only thing on /profile besides the identity strip.
 *
 * Cache-invalidation note: the app uses raw supabase-js queries with
 * useEffect, NOT React Query. After a reset, the user navigates to the
 * affected surface (Home / Chat / Reflect) and the component's mount-time
 * fetch picks up fresh data. No explicit invalidation needed — just the
 * existing fetch-on-mount pattern handles it.
 */
export function ReviewerConsole() {
  return (
    <Card>
      <SectionHeader title="Reviewer tools" variant="uppercase" />

      <p className="text-sm text-[#5A6B5F] leading-relaxed mb-4">
        These let you re-experience Savio&rsquo;s flows by resetting state to
        demo-ready conditions. Dev-only in spirit; visible by design so portfolio
        reviewers can replay a ritual, clear chat, or restore reflections.
      </p>

      <div>
        <ResetActionRow
          title="Reset April ritual"
          description="Returns April&rsquo;s monthly ritual to pending state. The check-in banner reappears on Home, the linked goal balance reverts, and the rollover allocation row is deleted."
          buttonLabel="Reset"
          confirmCopy="This will undo April&rsquo;s rollover allocation. Your goal balance reverts to its pre-ritual value. Continue?"
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
          description="Restores reflections to the seeded set (the 9 historical labels behind Myntra 100% regret rate, etc.). Labels you added during demo iteration will be cleared."
          buttonLabel="Restore"
          confirmCopy="Reflections added during this session will be deleted. The 9 seeded reflections come back. Continue?"
          onConfirm={resetReflectionsToSeed}
        />
      </div>
    </Card>
  );
}
