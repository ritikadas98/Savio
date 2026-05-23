export const DEMO_TODAY = new Date('2026-04-15T09:00:00+05:30');

export function today(): Date {
  return new Date(DEMO_TODAY.getTime());
}

export function daysUntil(targetDate: Date): number {
  const diffTime = targetDate.getTime() - today().getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function daysSince(targetDate: Date): number {
  const diffTime = today().getTime() - targetDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function currentMonthYearString(): string {
  const t = today();
  const year = t.getFullYear();
  const month = String(t.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
