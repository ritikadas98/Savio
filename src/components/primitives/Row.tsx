import React from 'react';
import { cn } from '../../lib/utils';

type RowProps = {
  icon?: React.ReactNode;
  label: React.ReactNode;
  sublabel?: React.ReactNode;
  value?: React.ReactNode;
  /** Right-side affordance: chevron, button, badge, etc. */
  trailing?: React.ReactNode;
  onClick?: () => void;
  className?: string;
};

// Stream 0.5-C: sizes baked per JSX preview lines 385/386/390 (transaction row).
//   label    14 / 400
//   sublabel 11.5 / 400 / T.s
//   value    14 / 500 / T.p
// Row is currently only consumed by RecentTransactionsList — when other
// consumers land (profile rows, etc.), inspect whether their JSX-spec sizes
// match; if they don't, parameterize this primitive.
export function Row({ icon, label, sublabel, value, trailing, onClick, className }: RowProps) {
  const content = (
    <>
      {icon && <div className="flex-shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 14, color: '#1A1A1A', lineHeight: 1.2 }} className="truncate">{label}</div>
        {sublabel && (
          <div style={{ fontSize: 11.5, color: '#5F5E5A', lineHeight: 1.3, marginTop: 1 }} className="truncate">
            {sublabel}
          </div>
        )}
      </div>
      {value && (
        <div style={{ fontSize: 14, color: '#1A1A1A', fontWeight: 500, lineHeight: 1.2 }} className="flex-shrink-0">
          {value}
        </div>
      )}
      {trailing && <div className="flex-shrink-0">{trailing}</div>}
    </>
  );

  const base = 'flex items-center gap-3 py-3 px-4 w-full text-left';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(base, 'hover:bg-black/[0.02] transition-colors', className)}
      >
        {content}
      </button>
    );
  }
  return <div className={cn(base, className)}>{content}</div>;
}
