export const DEMO_TODAY = new Date('2026-05-01T09:00:00+05:30');

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
  
  if (t.getDate() >= anchorDayOfMonth) {
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
