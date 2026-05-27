// Doc 1.15 — design tokens, mirrored from docs/savio_preview.jsx (preview T object).
//
// The preview file is the canonical source of truth for visual fidelity. These
// tokens are the in-code mirror; if the preview ever changes, update here and
// sweep the codebase for hardcoded literals that now diverge.
//
// CRITICAL: Strategist Navy (avStop = #0C447C) is reserved for AVATAR plate
// accents and icons. It must NOT be used for body text, hero numbers, page
// titles, or button labels in default contexts. The dominant text color in
// every page is `p` (#1A1A1A near-black). Navy is identity, not text color.
//
// Typography rule: weight 400 is the default. Weight 500 is used for
// emphasized elements (titles, hero numbers, pill text, button labels).
// There is NO weight 600 or 700 in the preview. Tailwind's font-bold (700)
// is drift anywhere it appears.

// Stream 0B: type scale tokens. Strict 56 / 36 / 24 / 16 per master plan §2.1
// with uniform 120% line-height. Doc 1.15/1.16 used custom sizes (30, 28, 26,
// 15, 14.5) — those collapse to this canonical scale. Use as React CSSProperties:
//   <h1 style={typography.title}>...
export const typography = {
  heading: { fontSize: 56, lineHeight: 1.2, fontWeight: 500, letterSpacing: '-1.5px' },
  title:   { fontSize: 36, lineHeight: 1.2, fontWeight: 500, letterSpacing: '-0.8px' },
  subheading: { fontSize: 24, lineHeight: 1.2, fontWeight: 500, letterSpacing: '-0.3px' },
  body:    { fontSize: 16, lineHeight: 1.2, fontWeight: 400 },
  bodySm:  { fontSize: 14, lineHeight: 1.2, fontWeight: 400 },
  caption: { fontSize: 12, lineHeight: 1.2, fontWeight: 400 },
  microCaption: { fontSize: 11, lineHeight: 1.2, fontWeight: 400 },
} as const;

export const tokens = {
  // Backgrounds
  bg: '#E4ECE6',           // page background (sage)
  card: '#FFFFFF',         // card background
  cardSoft: '#FAFAF7',     // soft card (e.g., recent transactions)

  // Text
  p: '#1A1A1A',            // primary (near-black) — ALL hero numbers, ALL page titles
  s: '#5F5E5A',            // secondary (mid-grey)
  t: '#888780',            // tertiary (subdued)

  // Borders
  border: 'rgba(0,0,0,0.07)',
  borderHover: 'rgba(0,0,0,0.14)',

  // Strategist (Priya) avatar palette
  avPlate: '#DCEEFF',      // light blue plate
  avStop: '#0C447C',       // dark Strategist Navy — icons/accents ONLY
  avAccent: '#58B9FF',     // mid-blue

  // Semantic accents — windfall (yellow)
  yPlate: '#FCF1CC',
  yStop: '#854F0B',
  yAccent: '#F4D123',

  // Semantic accents — positive/sage (green)
  gPlate: '#DEF2CB',
  gStop: '#3B6D11',
  gAccent: '#B2EF82',

  // Semantic accents — negative/alert (red)
  rPlate: '#FFE1E1',
  rStop: '#791F1F',
  rAccent: '#FF8F8F',
} as const;

export type TokenKey = keyof typeof tokens;
