// D.65 (Spec 2) — cross-runtime parity for the savings/cushion module.
// Same rationale as sts-parity.test.ts: src/lib/savings.ts and
// supabase/functions/_shared/savings.ts have to stay in lockstep
// because they implement the same cushion formula in two runtimes that
// can't share a module.

import { describe, it, expect } from 'vitest';
import { getSavingsState as getFrontend } from '../../src/lib/savings';
import { getSavingsState as getDeno } from '../../supabase/functions/_shared/savings';

type Fixture = {
  name: string;
  profile: { unearmarked_liquid?: number | null; safety_net?: number | null } | null;
  goals: Array<{ label?: string; current_amount?: number | null; backs_safety_net?: boolean | null }>;
  expectCushion: number;
  expectFloorCovered: boolean;
};

const FIXTURES: Fixture[] = [
  {
    name: 'Priya canonical: ₹50k unearmarked, EF ₹1.84L > ₹1L floor',
    profile: { unearmarked_liquid: 50000, safety_net: 100000 },
    goals: [
      { label: 'Phone fund',     current_amount:   8000, backs_safety_net: false },
      { label: 'Emergency fund', current_amount: 184000, backs_safety_net: true  },
      { label: 'Goa trip',       current_amount:   3000, backs_safety_net: false },
    ],
    expectCushion: 50000,    // EF covers floor → all unearmarked spendable
    expectFloorCovered: true,
  },
  {
    name: 'No unearmarked liquid → cushion 0 (still floor-covered by EF)',
    profile: { unearmarked_liquid: 0, safety_net: 100000 },
    goals: [
      { label: 'Emergency fund', current_amount: 184000, backs_safety_net: true },
    ],
    expectCushion: 0,
    expectFloorCovered: true,
  },
  {
    name: 'EF below floor, unearmarked plugs the gap',
    profile: { unearmarked_liquid: 70000, safety_net: 100000 },
    goals: [
      { label: 'Emergency fund', current_amount: 50000, backs_safety_net: true },
    ],
    // floor_drag = max(0, 100000 - 50000) = 50000
    // cushion = max(0, 70000 - 50000) = 20000
    // floor_covered: total accessible 50000+70000=120000 >= 100000 ✓
    expectCushion: 20000,
    expectFloorCovered: true,
  },
  {
    name: 'EF + unearmarked together still below floor — rebuild gap',
    profile: { unearmarked_liquid: 20000, safety_net: 100000 },
    goals: [
      { label: 'Emergency fund', current_amount: 50000, backs_safety_net: true },
    ],
    // total accessible 70000 < 100000 → not covered
    expectCushion: 0,
    expectFloorCovered: false,
  },
  {
    name: 'No goal flagged as backer — unearmarked alone has to cover floor',
    profile: { unearmarked_liquid: 150000, safety_net: 100000 },
    goals: [
      { label: 'Phone fund', current_amount: 8000, backs_safety_net: false },
    ],
    // backer_balance = 0, floor_drag = 100000
    // cushion = max(0, 150000 - 100000) = 50000
    expectCushion: 50000,
    expectFloorCovered: true,
  },
  {
    name: 'Null profile → defaults flow through (no crash, zeroes)',
    profile: null,
    goals: [],
    expectCushion: 0,
    expectFloorCovered: false,
  },
];

describe('Savings cross-runtime parity (D.65 Spec 2)', () => {
  for (const f of FIXTURES) {
    it(`getSavingsState identical across runtimes: ${f.name}`, () => {
      const fe = getFrontend(f.profile, f.goals);
      const de = getDeno(f.profile, f.goals);
      expect(fe).toEqual(de);
    });

    it(`cushion + floor coverage match expectations: ${f.name}`, () => {
      const s = getFrontend(f.profile, f.goals);
      expect(s.cushion).toBe(f.expectCushion);
      expect(s.floorCovered).toBe(f.expectFloorCovered);
    });
  }

  it('Never returns negative cushion (always ≥ 0)', () => {
    const s = getFrontend({ unearmarked_liquid: 1000, safety_net: 100000 }, []);
    expect(s.cushion).toBeGreaterThanOrEqual(0);
  });
});
