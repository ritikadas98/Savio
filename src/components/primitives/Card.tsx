import React from 'react';
import { cn } from '../../lib/utils';

type AccentColor = 'yellow' | 'blue' | 'green' | 'red';

type CardProps = {
  /** default = regular card; hero = larger radius/padding for headline cards; accent overrides borders */
  variant?: 'default' | 'hero';
  /** When set, gives the card a 2px accent-color border (overrides the default thin border) */
  accentColor?: AccentColor;
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'className' | 'children'>;

// Class names are written out as literals so Tailwind's content scanner picks
// them up. Don't switch to dynamic string interpolation here.
const ACCENT_BORDER: Record<AccentColor, string> = {
  yellow: 'border-2 border-yellow-accent/30',
  blue:   'border-2 border-blue-accent/30',
  green:  'border-2 border-green-accent/30',
  red:    'border-2 border-red-accent/30',
};

const VARIANT_BASE: Record<NonNullable<CardProps['variant']>, string> = {
  default: 'p-5 rounded-[24px] shadow-sm',
  hero:    'p-7 rounded-[32px] shadow-sm',
};

export function Card({ variant = 'default', accentColor, className, children, ...rest }: CardProps) {
  const border = accentColor ? ACCENT_BORDER[accentColor] : 'border border-borderSoft';
  return (
    <div className={cn('bg-white', VARIANT_BASE[variant], border, className)} {...rest}>
      {children}
    </div>
  );
}
