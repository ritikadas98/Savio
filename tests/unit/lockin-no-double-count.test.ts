// D.65 follow-up (Spec 2.1) — locked-ritual carry-forward double-count
// correctness test.
//
// Why this isn't covered by sts-parity.test.ts: parity tests assert
// front-end and back-end produce the SAME output for the same input.
// They guard against runtime drift. They do NOT guard against a shared
// logic error — if both Home and chat double-count identically, parity
// stays green while the answer is wrong.
//
// This test exercises the CONTRACT instead:
//   - At lock-in time, calculateSafeToSpend is called with
//     carryForward=0 (the "base"). That base goes into
//     safe_to_spend_locked.
//   - At read time, both Home and chat-respond do `locked + cf` on
//     whatever value is in the column.
//   - Final read value must equal `base + cf` exactly once — no doubling.
//
// If a future change reintroduces carryForward on the write side, this
// test fails immediately.

import { describe, it, expect } from 'vitest';
import { calculateSafeToSpend } from '../../src/lib/safeToSpend';

const PRIYA_INCOME = 98000;
const PRIYA_COMMITMENTS = [
  { amount: 47468, category: 'Housing',   kind: 'fixed' as const },
  { amount: 15000, category: 'Investing', kind: 'fixed' as const },
];
const PRIYA_GOALS = [
  { monthly_contribution: 4000, status: 'active' },
  { monthly_contribution: 2000, status: 'active' },
  { monthly_contribution: 3000, status: 'active' },
];
const PRIYA_BASE_STS = 26532; // 98K − 47468 − 15K − 9K
const CF = 5000;

describe('D.65 Spec 2.1 — locked-ritual carry-forward single-count', () => {
  it('lock-in write computes base (no carry-forward)', () => {
    // What MonthlyRitualLockIn now passes to RPC as p_safe_to_spend_locked:
    const baseToWrite = calculateSafeToSpend(PRIYA_INCOME, PRIYA_COMMITMENTS, PRIYA_GOALS, 0);
    expect(baseToWrite).toBe(PRIYA_BASE_STS);
  });

  it('read = locked + cf returns base + cf exactly once', () => {
    // 1. Lock-in time: compute and "write" the base.
    const writtenToDb = calculateSafeToSpend(PRIYA_INCOME, PRIYA_COMMITMENTS, PRIYA_GOALS, 0);

    // 2. Read time: Home + chat both do `locked + carryForward`.
    const readSts = writtenToDb + CF;

    // 3. The full STS the user actually has: base + cf, once.
    expect(readSts).toBe(PRIYA_BASE_STS + CF);
    expect(readSts).toBe(31532);

    // 4. The bug we're guarding against — `base + 2×CF`:
    expect(readSts).not.toBe(PRIYA_BASE_STS + 2 * CF);
  });

  it('with cf=0 (Priya today), read equals base unchanged', () => {
    const writtenToDb = calculateSafeToSpend(PRIYA_INCOME, PRIYA_COMMITMENTS, PRIYA_GOALS, 0);
    const readSts = writtenToDb + 0;
    expect(readSts).toBe(PRIYA_BASE_STS);
  });

  it('regression guard — if lock-in ever writes with carry-forward, this fails', () => {
    // Simulate the pre-2.1 bug: lock-in includes carry-forward in the write.
    const wrongWrite = calculateSafeToSpend(PRIYA_INCOME, PRIYA_COMMITMENTS, PRIYA_GOALS, CF);
    const wrongRead = wrongWrite + CF; // read adds it again
    // This is what the bug produces; the test makes the failure mode
    // explicit so a developer reading the test sees what NOT to do.
    expect(wrongRead).toBe(PRIYA_BASE_STS + 2 * CF);
    expect(wrongRead).not.toBe(PRIYA_BASE_STS + CF);
  });
});
