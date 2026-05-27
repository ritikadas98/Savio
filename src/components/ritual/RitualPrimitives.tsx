import React from 'react';
import { X, ArrowRight } from 'lucide-react';

// Phase C1: shared inline primitives for the 4 new ritual screens (Income,
// Commitments, Focus, Lock-in). Match JSX preview Header2 / Title /
// PrimaryButton at lines 1139-1176.
//
// Existing close-out screens (CloseOut / Rollover / Complete) already use
// their own header pattern; refactoring them to use these primitives is
// out of scope for C1 — keeping risk low on the working close-out flow.

export function RitualHeader({
  stepLabel,
  onClose,
  sectionLabel = 'Monthly check-in',
}: {
  stepLabel: string;
  onClose: () => void;
  sectionLabel?: string;
}) {
  return (
    <header
      className="flex-shrink-0 flex items-center justify-between"
      style={{ padding: '14px 22px' }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Exit"
        className="text-[#1A1A1A] hover:opacity-70 transition-opacity"
        style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
      >
        <X size={20} />
      </button>
      <div
        style={{
          fontSize: 11,
          color: '#888780',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        {sectionLabel} · {stepLabel}
      </div>
      <div style={{ width: 20 }} />
    </header>
  );
}

export function RitualTitle({
  children,
  sub,
}: {
  children: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div style={{ padding: '0 22px 18px' }}>
      <h1
        style={{
          fontSize: 28,
          fontWeight: 400,
          color: '#1A1A1A',
          lineHeight: 1.15,
          letterSpacing: '-0.5px',
          marginBottom: sub ? 8 : 0,
          margin: 0,
        }}
      >
        {children}
      </h1>
      {sub && (
        <div style={{ fontSize: 13.5, color: '#5F5E5A', lineHeight: 1.5, marginTop: 8 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function RitualPrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="hover:opacity-90 transition-opacity disabled:opacity-40"
      style={{
        width: '100%',
        padding: '14px 24px',
        backgroundColor: '#1A1A1A',
        color: '#FFFFFF',
        border: 'none',
        borderRadius: 999,
        fontSize: 15,
        fontWeight: 500,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      {children}
    </button>
  );
}

// Convenience re-export so screens can import everything from one path.
export { ArrowRight };
