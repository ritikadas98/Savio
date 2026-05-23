import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

export function SaveDecisionButton({ decisionText, verdict, amount, messageId }: { decisionText: string, verdict: string, amount: number | null, messageId: string }) {
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('saved_decisions').insert({
      user_id: user.id,
      decision_text: decisionText,
      verdict,
      amount,
      related_message_id: messageId
    });
    setSaved(true);
    // Ideally, show a toast here.
  };

  if (saved) {
    return <div className="text-caption text-secondary mt-2">✓ Decision saved</div>;
  }

  return (
    <button 
      onClick={handleSave}
      className="mt-2 text-caption font-medium px-3 py-1.5 rounded-full border border-black/10 text-primary hover:bg-black/5 transition-colors"
    >
      Save this decision
    </button>
  );
}
