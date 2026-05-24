export const DEMO_TODAY = new Date('2026-04-15T09:00:00+05:30');

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
