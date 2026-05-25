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

export function Row({ icon, label, sublabel, value, trailing, onClick, className }: RowProps) {
  const content = (
    <>
      {icon && <div className="flex-shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[#1A1A1A] truncate">{label}</div>
        {sublabel && <div className="text-sm text-[#5A6B5F] truncate">{sublabel}</div>}
      </div>
      {value && <div className="font-medium text-[#0C447C] flex-shrink-0">{value}</div>}
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
