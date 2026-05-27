import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { verdictDbValue, type StructuredVerdict, type VerdictColor } from '../../lib/chat-types';

// Stream 0.5e: faint pill outline + tight padding layered on top of the
// Stream 0.5d text-link treatment. Deliberate departure from JSX preview's
// pure-text pattern (lines 468-470) — in screenshots a pure text-link can
// read as accidentally unstyled rather than deliberately quiet. The pill+
// hairline vocabulary already exists in the design system (BottomNav, CTAs)
// so this borrows it at a tinier scale rather than introducing foreign chrome.
//
// Phase C3 — extended to carry structured verdict payload. New required call
// site: VerdictCard. The existing MessageBubble call site (prose verdicts
// from the metadata.is_verdict path) continues to pass structured=undefined.
//
// Also fixes a pre-existing bug: the insert used `user.id` (auth.users.id)
// but the RLS policy requires `saved_decisions.user_id = profiles.id`.
// Saved rows would have failed RLS. Now resolves profile.id first.

const PILL_BASE: React.CSSProperties = {
  fontSize: 11,
  color: '#5F5E5A',
  padding: '5px 12px',
  borderRadius: 999,
  background: 'transparent',
  fontFamily: 'inherit',
  fontWeight: 400,
  display: 'inline-block',
  lineHeight: 1.4,
  transition: 'background-color 120ms ease, border-color 120ms ease',
};

// Verdict text passed from MessageBubble (the legacy prose path) can be 'amber'
// — the schema enum value. From VerdictCard (Phase C3) it's a VerdictColor
// (GREEN/YELLOW/RED). Accept either and normalize on write.
type VerdictProp = VerdictColor | 'green' | 'amber' | 'red' | string;

function normalizeVerdict(v: VerdictProp): 'green' | 'amber' | 'red' {
  if (v === 'GREEN' || v === 'YELLOW' || v === 'RED') return verdictDbValue(v);
  if (v === 'green' || v === 'amber' || v === 'red') return v;
  return 'amber';
}

export function SaveDecisionButton({
  decisionText,
  verdict,
  amount,
  messageId,
  structured,
}: {
  decisionText: string;
  verdict: VerdictProp;
  amount: number | null;
  messageId: string;
  structured?: StructuredVerdict;
}) {
  const [saved, setSaved] = useState(false);
  const [hover, setHover] = useState(false);

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();
    if (!profile) return;
    await supabase.from('saved_decisions').insert({
      user_id: profile.id,
      decision_text: decisionText,
      verdict: normalizeVerdict(verdict),
      amount,
      related_message_id: messageId,
      decision_data: structured ?? null,
    });
    setSaved(true);
  };

  if (saved) {
    return (
      <div style={{ textAlign: 'right', marginTop: 10 }}>
        <span style={{ ...PILL_BASE, border: '0.5px solid rgba(0,0,0,0.08)' }}>
          ✓ Decision saved
        </span>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'right', marginTop: 10 }}>
      <button
        type="button"
        onClick={handleSave}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          ...PILL_BASE,
          border: `0.5px solid rgba(0,0,0,${hover ? 0.12 : 0.08})`,
          backgroundColor: hover ? 'rgba(0,0,0,0.02)' : 'transparent',
          cursor: 'pointer',
        }}
      >
        Save this decision →
      </button>
    </div>
  );
}
