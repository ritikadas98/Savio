import { describe, it, expect } from 'vitest';
import { calculateSafeToSpend } from '../../src/lib/safeToSpend';

describe('calculateSafeToSpend', () => {
  it('calculates correctly for Priya (post-D.64)', () => {
    // D.64 (Spec 1, revises D.63): investing commitments now deduct from STS.
    // D.47 income raise (68500 → 98000) unchanged. New decomposition:
    //   98000 − 47468 (non-investing) − 15000 (investing SIPs) − 9000 (goals) = 26532
    const commitments = [
      { amount: 47468, category: 'Housing' },   // Mocking all non-investing commitments
      { amount: 15000, category: 'Investing' }, // Now ALSO deducted (D.64)
    ];

    const goals = [
      { monthly_contribution: 4000, status: 'active' }, // Phone fund
      { monthly_contribution: 2000, status: 'active' }, // Emergency fund
      { monthly_contribution: 3000, status: 'active' }, // Goa trip
      { monthly_contribution: 5000, status: 'paused' }, // Paused goal — excluded
    ];

    const result = calculateSafeToSpend(98000, commitments, goals);
    expect(result).toBe(26532);
  });

  it('returns monthly_income_net for empty user', () => {
    const result = calculateSafeToSpend(50000, [], []);
    expect(result).toBe(50000);
  });

  it('returns 0 if monthly_income_net is null', () => {
    const result = calculateSafeToSpend(null, [], []);
    expect(result).toBe(0);
  });
});
