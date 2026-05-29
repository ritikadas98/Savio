import { describe, it, expect } from 'vitest';
import { calculateSafeToSpend } from '../../src/lib/safeToSpend';

describe('calculateSafeToSpend', () => {
  it('calculates correctly for Priya', () => {
    // D.47 (Stream 0.5t piece #1): net income raised 68500 → 98000.
    // Non-investing commitments + active goal contributions unchanged:
    //   98000 − 47468 (non-investing) − 9000 (active goal contribs) = 41532
    const commitments = [
      { amount: 47468, category: 'Housing' }, // Mocking all non-investing commitments
      { amount: 15000, category: 'Investing' }, // Should be excluded
    ];

    const goals = [
      { monthly_contribution: 4000, status: 'active' }, // Phone fund
      { monthly_contribution: 2000, status: 'active' }, // Emergency fund
      { monthly_contribution: 3000, status: 'active' }, // Goa trip
      { monthly_contribution: 5000, status: 'paused' }, // Paused goal, should be excluded
    ];

    const result = calculateSafeToSpend(98000, commitments, goals);
    expect(result).toBe(41532);
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
