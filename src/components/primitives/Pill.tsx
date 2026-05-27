import React from 'react';
import { cn } from '../../lib/utils';

type PillVariant = 'sage' | 'navy' | 'yellow' | 'red' | 'neutral';
type PillSize = 'sm' | 'md';

type PillProps = {
  variant: PillVariant;
  size?: PillSize;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  title?: string;
};

const VARIANT_STYLES: Record<PillVariant, string> = {
  sage:    'bg-[#B2EF82]/30 text-[#2D5016]',
  navy:    'bg-[#DCEEFF] text-[#0C447C]',
  yellow:  'bg-[#F4D123]/20 text-[#854F0B]',
  red:     'bg-[#FFE1E1] text-[#791F1F]',
  neutral: 'bg-black/5 text-[#5F5E5A]',
};

const SIZE_STYLES: Record<PillSize, string> = {
  sm: 'text-[11px] px-2 py-0.5',
  md: 'text-xs px-3 py-1',
};

export function Pill({ variant, size = 'sm', icon, className, children, title }: PillProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium leading-none',
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
