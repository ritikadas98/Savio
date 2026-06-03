// D.65 (Spec 2) — cross-runtime STS parity. The safe-to-spend formula
// lives twice — src/lib/safeToSpend.ts (browser) and
// supabase/functions/_shared/safeToSpend.ts (Deno) — because the two
// runtimes can't share a module. This test runs the same fixture
// through both implementations and asserts byte-identical output, so
// any future edit that touches only one side breaks CI rather than
// shipping a silent linear-consistency drift.
//
// This is the test that would have caught the carry-forward gap D.65
// fixed (Home added carry-forward to STS, chat-respond did not).

import { describe, it, expect } from 'vitest';
import {
  computeStsBreakdown as computeFrontend,
  calculateSafeToSpend as calcFrontend,
} from '../../src/lib/safeToSpend';
import {
  computeStsBreakdown as computeDeno,
  calculateSafeToSpend as calcDeno,
} from '../../supabase/functions/_shared/safeToSpend';

type Fixture = {
  name: string;
  incomeNet: number | null;
  commitments: Array<{ amount: number; category?: string | null; kind?: 'fixed' | 'variable' | null }>;
  goals: Array<{ monthly_contribution?: number | null; status?: string | null }>;
  carryForward?: number;
};

const FIXTURES: Fixture[] = [
  {
    name: "Priya canonical (D.64 baseline, no carry-forward)",
    incomeNet: 98000,
    commitments: [
      { amount: 47468, category: 'Housing',   kind: 'fixed' },
      { amount: 15000, category: 'Investing', kind: 'fixed' },
      { amount:  6000, category: 'Food',      kind: 'variable' },
    ],
    goals: [
      { monthly_contribution: 4000, status: 'active' },
      { monthly_contribution: 2000, status: 'active' },
      { monthly_contribution: 3000, status: 'active' },
      { monthly_contribution: 5000, status: 'paused' },
    ],
    carryForward: 0,
  },
  {
    name: "Priya with non-zero carry-forward (the bug D.65 fixed)",
    // This is the case that would have failed before D.65: Home added
    // carry_forward, chat didn't. Both sides must now produce the same
    // STS.
    incomeNet: 98000,
    commitments: [
      { amount: 47468, category: 'Housing',   kind: 'fixed' },
      { amount: 15000, category: 'Investing', kind: 'fixed' },
    ],
    goals: [
      { monthly_contribution: 4000, status: 'active' },
      { monthly_contribution: 2000, status: 'active' },
      { monthly_contribution: 3000, status: 'active' },
    ],
    carryForward: 5000,
  },
  {
    name: "Empty state — no income",
    incomeNet: null,
    commitments: [],
    goals: [],
    carryForward: 0,
  },
  {
    name: "Investment category case variations",
    // Case-insensitive matching: 'investment' (no 'ing'), 'INVESTING' all caps.
    incomeNet: 50000,
    commitments: [
      { amount: 10000, category: 'investing',  kind: 'fixed' },
      { amount:  5000, category: 'Investment', kind: 'fixed' },
      { amount:  3000, category: 'Other',      kind: 'fixed' },
    ],
    goals: [],
    carryForward: 0,
  },
  {
    name: "Missing kind defaults to fixed (backward compat)",
    incomeNet: 50000,
    commitments: [
      { amount: 10000, category: 'Housing' }, // no kind → fixed
    ],
    goals: [],
    carryForward: 0,
  },
];

describe('STS cross-runtime parity (D.65 Spec 2)', () => {
  for (const f of FIXTURES) {
    it(`computeStsBreakdown identical across runtimes: ${f.name}`, () => {
      const fe = computeFrontend(f.incomeNet, f.commitments, f.goals, f.carryForward ?? 0);
      const de = computeDeno(f.incomeNet, f.commitments, f.goals, f.carryForward ?? 0);
      expect(fe).toEqual(de);
    });

    it(`calculateSafeToSpend identical across runtimes: ${f.name}`, () => {
      const fe = calcFrontend(f.incomeNet, f.commitments, f.goals, f.carryForward ?? 0);
      const de = calcDeno(f.incomeNet, f.commitments, f.goals, f.carryForward ?? 0);
      expect(fe).toBe(de);
    });
  }

  it('Priya canonical produces STS ₹26,532 (Spec 1 baseline)', () => {
    const breakdown = computeFrontend(98000, [
      { amount: 47468, category: 'Housing',   kind: 'fixed' },
      { amount: 15000, category: 'Investing', kind: 'fixed' },
    ], [
      { monthly_contribution: 4000, status: 'active' },
      { monthly_contribution: 2000, status: 'active' },
      { monthly_contribution: 3000, status: 'active' },
    ], 0);
    expect(breakdown.safeToSpend).toBe(26532);
  });

  it('Carry-forward adds to STS (D.65 fix)', () => {
    const baseline = computeFrontend(98000, [
      { amount: 47468, category: 'Housing',   kind: 'fixed' },
      { amount: 15000, category: 'Investing', kind: 'fixed' },
    ], [
      { monthly_contribution: 9000, status: 'active' },
    ], 0);
    const withCarry = computeFrontend(98000, [
      { amount: 47468, category: 'Housing',   kind: 'fixed' },
      { amount: 15000, category: 'Investing', kind: 'fixed' },
    ], [
      { monthly_contribution: 9000, status: 'active' },
    ], 5000);
    expect(withCarry.safeToSpend - baseline.safeToSpend).toBe(5000);
    expect(withCarry.carryForward).toBe(5000);
  });
});
