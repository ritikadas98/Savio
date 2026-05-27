import React, { useEffect } from 'react';

// Phase B1: minimal snackbar for [PRESENTATIONAL] row stubs on Profile.
// Renders fixed at the bottom of the page when message is non-null. Caller
// holds the state and clears it via onDismiss after the timeout.
//
// Not using shadcn's use-toast because Toaster isn't mounted globally and
// pulling it in for this single surface is scope creep. If chat/ritual
// surfaces need snackbar later, factor up.
type Props = {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
};

export function Snackbar({ message, onDismiss, durationMs = 2500 }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="status"
      className="fixed left-0 right-0 flex justify-center pointer-events-none"
      style={{ bottom: 96, zIndex: 60 }}
    >
      <div
        style={{
          backgroundColor: '#1A1A1A',
          color: '#FFFFFF',
          padding: '10px 18px',
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 400,
          maxWidth: 360,
          textAlign: 'center',
        }}
      >
        {message}
      </div>
    </div>
  );
}
