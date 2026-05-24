import React from 'react';

type AvatarConfig = { bg: string; stroke: string; glyph: React.ReactNode };

const AVATARS: Record<string, AvatarConfig> = {
  strategist: {
    bg: '#DCEEFF',
    stroke: '#0C447C',
    glyph: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </>
    ),
  },
  adventurer: {
    bg: '#FCF1CC',
    stroke: '#854F0B',
    glyph: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  },
  builder: {
    bg: '#DEF2CB',
    stroke: '#3B6D11',
    glyph: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6.6 6.6a1.4 1.4 0 0 0 2 2l6.6-6.6a4 4 0 0 0 5.4-5.4l-2.4 2.4-2-2 2.4-2.4z" />,
  },
};

export function ProfilePill({ avatar }: { avatar?: string | null }) {
  const key = (avatar || 'strategist').toLowerCase();
  const av = AVATARS[key] ?? AVATARS.strategist;
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center border flex-shrink-0"
      style={{ backgroundColor: av.bg, borderColor: av.stroke + '1A' }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={av.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {av.glyph}
      </svg>
    </div>
  );
}
