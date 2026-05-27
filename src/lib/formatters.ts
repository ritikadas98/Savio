// Phase B1: shared formatters for Profile and other surfaces.
//
// Indian numbering convention groups by 1,00,000 (lakh) not 100,000. Intl
// supports this via the 'en-IN' locale. Use formatRupeesIndian for any user-
// facing rupee value that should follow Indian convention.

export function formatRupeesIndian(n: number, opts: { decimals?: number } = {}): string {
  const decimals = opts.decimals ?? 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(n);
}

// Phase B3: compact rupee formatting for hero numbers on Goals cards.
// Indian numbering: 1 Lakh = 1,00,000 (₹1L), 1 Crore = 1,00,00,000 (₹1Cr).
// Below ₹1L falls back to full formatRupeesIndian grouping.
export function inrCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  return formatRupeesIndian(n);
}

export function ordinalSuffix(n: number): string {
  if (n >= 11 && n <= 13) return `${n}th`;
  const last = n % 10;
  const suffix = last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

// "12 April 2026" — full month name, day no leading zero, four-digit year.
export function formatDateLong(d: Date | string | number | null | undefined): string {
  if (d == null) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}
