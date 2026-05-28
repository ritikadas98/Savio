import { Smile, Meh, Frown, type LucideIcon } from 'lucide-react';

// Phase B2: shared mood config for reflection labeling surfaces (Reflect tab,
// ritual close-out's "Looking back" section). DB stores 'glad' | 'neutral' |
// 'regret' per schema CHECK constraint; UI displays "Worth it" / "Neutral" /
// "Regret" per PM_DECISIONS reflection-section lock (despite JSX preview line
// 593 using "Glad" — PM_DECISIONS supersedes JSX on copy vocabulary).

export type ReflectionLabel = 'glad' | 'neutral' | 'regret';

export type MoodMeta = {
  display: string;
  pillVariant: 'sage' | 'neutral' | 'red';
  Icon: LucideIcon;
  /** Background color for the larger 36-38px plate used on Reflect cards. */
  plateBg: string;
  /** Icon stroke color for that plate. */
  plateColor: string;
};

export const MOOD_META: Record<ReflectionLabel, MoodMeta> = {
  glad: {
    display: 'Worth it',
    pillVariant: 'sage',
    Icon: Smile,
    plateBg: '#DEF2CB',
    plateColor: '#3B6D11',
  },
  neutral: {
    display: 'Neutral',
    pillVariant: 'neutral',
    Icon: Meh,
    plateBg: '#F4F4F2',
    plateColor: '#5F5E5A',
  },
  regret: {
    display: 'Regret',
    pillVariant: 'red',
    Icon: Frown,
    plateBg: '#FFE1E1',
    plateColor: '#791F1F',
  },
};

// Ordered for consistent button rendering: regret first (most useful PM signal),
// neutral middle, worth-it last.
export const ORDERED_MOODS: ReflectionLabel[] = ['regret', 'neutral', 'glad'];
