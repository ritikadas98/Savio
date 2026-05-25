import React from 'react';
import { cn } from '../../lib/utils';

type SectionHeaderProps = {
  title: string;
  /** Right-side affordance: "See all →" link, button, etc. */
  action?: React.ReactNode;
  /** uppercase = small-caps eyebrow style; default = sentence-case label */
  variant?: 'default' | 'uppercase';
  className?: string;
};

export function SectionHeader({ title, action, variant = 'default', className }: SectionHeaderProps) {
  const titleClass =
    variant === 'uppercase'
      ? 'text-xs font-medium tracking-wider uppercase text-[#5A6B5F]'
      : 'text-sm font-medium text-[#5A6B5F]';
  return (
    <div className={cn('flex items-center justify-between mb-2', className)}>
      <h2 className={titleClass}>{title}</h2>
      {action}
    </div>
  );
}
