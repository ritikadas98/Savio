import React from 'react';
import { cn } from '../../lib/utils';

type AccentColor = 'yellow' | 'blue' | 'green' | 'red';

type CardProps = {
  /** default = regular card; hero = larger radius/padding for headline cards;
   *  inset = compact nested card (tradeoff callouts, secondary surfaces).
   *  accent overrides borders */
  variant?: 'default' | 'hero' | 'inset';
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

// Doc 1.16 tightening + Stream 0.5-F shadow removal. Per master plan §2.1 #5
// and JSX preview Card component (lines 57-72), card chrome is hairline
// border only — no shadows, no elevations. Border-radius matches JSX: 22
// default, 24 hero, 16 inset.
const VARIANT_BASE: Record<NonNullable<CardProps['variant']>, string> = {
  default: 'p-4 rounded-[22px]',
  hero:    'p-5 rounded-[24px]',
  inset:   'p-3 rounded-[16px]',
};

export function Card({ variant = 'default', accentColor, className, children, ...rest }: CardProps) {
  const border = accentColor ? ACCENT_BORDER[accentColor] : 'border border-borderSoft';
  return (
    <div className={cn('bg-white', VARIANT_BASE[variant], border, className)} {...rest}>
      {children}
    </div>
  );
}
