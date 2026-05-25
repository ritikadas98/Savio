// DEMO_TODAY is pinned to the 1st of the current real-world calendar month
// at 9:00 AM IST. This keeps the demo's "month just began" framing always
// current: visitors always open Savio at the most product-resonant moment
// (salary just landed, safe-to-spend to plan the new month).
//
// Computed once at module load — the value is stable for the lifetime of
// the page session. Crossing a month boundary requires a re-seed (see
// scripts/apply-migrations.js, which automatically substitutes v_demo_today).
//
// Uses Intl with Asia/Kolkata so the "current month" is determined in IST
// regardless of where the page is served from — keeps the demo's monthly
// rollover predictable for an India-based audience.
//
// ESLint blocks new Date() outside this file; this is the one place it lives.
function computeDemoToday(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find(p => p.type === 'year')!.value;
  const month = parts.find(p => p.type === 'month')!.value;
  return new Date(`${year}-${month}-01T09:00:00+05:30`);
}

export const DEMO_TODAY = computeDemoToday();

export function today(): Date {
  return DEMO_TODAY;
}

export function daysUntil(targetDate: Date): number {
  const diffTime = targetDate.getTime() - DEMO_TODAY.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getNextAnchorDate(anchorDayOfMonth: number): Date {
  const t = today();
  let year = t.getFullYear();
  let month = t.getMonth();

  // Use strict > so that ON the anchor day itself, this returns today
  // (not "31 days from now"). UI consumers display "Payday!" when diffDays
  // is 0; this avoids the contradictory "31 days until salary" message
  // showing on the very day the salary lands.
  if (t.getDate() > anchorDayOfMonth) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return new Date(year, month, anchorDayOfMonth);
}

export function parseDate(dateStr?: string | number | Date): Date {
  return dateStr ? new Date(dateStr) : new Date();
}

export function getRealNow(): Date {
  return new Date();
}

export function formatMonthYear(monthYear: string): string {
  const [yearStr, monthStr] = monthYear.split('-');
  const y = Number(yearStr);
  const m = Number(monthStr) - 1;
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 0 || m > 11) return monthYear;
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(y, m, 1));
}

export function formatMonthName(monthYear: string): string {
  const [yearStr, monthStr] = monthYear.split('-');
  const y = Number(yearStr);
  const m = Number(monthStr) - 1;
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 0 || m > 11) return monthYear;
  return new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date(y, m, 1));
}

// Returns the previous month's 1st-of-month date as 'YYYY-MM-DD' (UTC-safe).
// Used by the ritual rollover lookup — "what was last month's ritual_month?"
export function getPreviousMonthFirstDate(): string {
  const t = DEMO_TODAY;
  let y = t.getFullYear();
  let m = t.getMonth(); // 0-indexed
  m -= 1;
  if (m < 0) { m = 11; y -= 1; }
  return `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

// Calendar-day relative formatter pinned to DEMO_TODAY.
// Returns "Today" / "Yesterday" / "N days ago" / "N weeks ago" / a short date.
export function formatRelativeDate(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(d.getTime())) return '';
  const t = DEMO_TODAY;
  const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const tStart = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const diffDays = Math.round((tStart.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  if (diffDays >= 7 && diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? 'Last week' : `${weeks} weeks ago`;
  }
  if (diffDays < 0) return 'Upcoming';
  return new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric' }).format(d);
}
