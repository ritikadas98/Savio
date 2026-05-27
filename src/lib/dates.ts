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

// Phase B2: N days before DEMO_TODAY as a Date object. Used for "last 30 days"
// query windows. Caller .toISOString() the result for Supabase query bounds.
export function daysAgo(n: number): Date {
  return new Date(DEMO_TODAY.getTime() - n * 86_400_000);
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

// Phase B3: format a goal's target_date as "Aug 2026" / "Dec 2027" etc.
// Short month abbreviation + four-digit year. Used in Goals card sublabel
// ("Target Aug 2026 · ₹4,000/month").
export function formatGoalDueDate(input: Date | string | null | undefined): string {
  if (input == null) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(d);
}

export function formatMonthYear(monthYear: string): string {
  const [yearStr, monthStr] = monthYear.split('-');
  const y = Number(yearStr);
  const m = Number(monthStr) - 1;
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 0 || m > 11) return monthYear;
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(y, m, 1));
}

// Stream 0H: previous month's full name relative to DEMO_TODAY (e.g. "April"
// when DEMO_TODAY = 2026-05-01). Used by Reviewer Console to label the
// "most recent closed ritual" action dynamically.
export function getPreviousMonthName(): string {
  const t = DEMO_TODAY;
  let y = t.getFullYear();
  let m = t.getMonth(); // 0-indexed
  m -= 1;
  if (m < 0) { m = 11; y -= 1; }
  return new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date(y, m, 1));
}

// Stream 0H: given a 'YYYY-MM' string, return the next month's full name.
// Wraps year correctly for December → January.
export function getNextMonthName(monthYear: string): string {
  const [yearStr, monthStr] = monthYear.split('-');
  const y = Number(yearStr);
  const m = Number(monthStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return '';
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  return new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date(nextY, nextM - 1, 1));
}

export function formatMonthName(monthYear: string): string {
  const [yearStr, monthStr] = monthYear.split('-');
  const y = Number(yearStr);
  const m = Number(monthStr) - 1;
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 0 || m > 11) return monthYear;
  return new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date(y, m, 1));
}

// Returns the "this week" range used by the home CommitmentsCard.
//   startDay/endDay  = day-of-month integers (used to filter commitments by
//                      due_day_of_month — column added in migration 0012)
//   startDate/endDate = Date objects bracketing the same 7-day window
//                      (endDate is exclusive — use `< endDate` in queries)
//
// Simple definition: week = today + 6 more days. Doesn't wrap across month
// boundaries in the day-integer view; for the demo's May 1 anchor day this
// produces days 1–7, which is what the reference UI shows. End-of-month
// wrap (e.g. May 28 → Jun 3 spanning two months) is a Phase 6 polish — for
// the current demo state it can't trigger.
export function getThisWeekRange(): {
  startDay: number;
  endDay: number;
  startDate: Date;
  endDate: Date;
} {
  const t = today();
  const startDay = t.getDate();
  const endDay = startDay + 6;
  const startDate = new Date(t.getFullYear(), t.getMonth(), startDay);
  const endDate = new Date(t.getFullYear(), t.getMonth(), startDay + 7); // exclusive
  return { startDay, endDay, startDate, endDate };
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
