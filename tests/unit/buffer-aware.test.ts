// D.66 (Spec 3) — unit tests for the buffer-aware classifier. The Edge
// Function imports the module via a relative path; Vitest imports it
// from the same place. No Deno-specific globals so the import "just
// works" — same pattern as savings/safeToSpend mirror modules.

import { describe, it, expect } from 'vitest';
import { extractPrice, classifyBuffer } from '../../supabase/functions/_shared/bufferAware';

describe('extractPrice — D.66 Spec 3', () => {
  const cases: Array<[string, number | null]> = [
    // Plain numeric
    ['Can I afford a ₹35,000 laptop?', 35000],
    ['Should I buy a ₹50,000 laptop?', 50000],
    ['₹1,00,000 Apple Watch', 100000],
    ['Is ₹3,500 fine?', 3500],
    // Shorthand: K
    ['Can I afford a ₹8k watch?', 8000],
    ['What about an ₹8K watch?', 8000],
    ['₹2.5k coffee subscription', 2500],
    // Shorthand: L (lakh)
    ['₹1L Apple Watch', 100000],
    ['₹1.5L laptop', 150000],
    ['₹2L emergency expense', 200000],
    // No price
    ['How am I doing this month?', null],
    ['Should I invest in mutual funds?', null],
    // First match wins
    ['Goa trip ₹12,000 vs Apple Watch ₹1L?', 12000],
  ];

  for (const [input, expected] of cases) {
    it(`extracts ${expected} from "${input}"`, () => {
      expect(extractPrice(input)).toBe(expected);
    });
  }
});

describe('classifyBuffer — D.66 Spec 3', () => {
  // Priya canonical: STS ₹26,532, cushion ₹50,000, safety_net ₹1,00,000.
  const STS = 26532;
  const CUSHION = 50000;
  const SN = 100000;

  it('returns no_price when price is null', () => {
    expect(classifyBuffer(null, STS, CUSHION, SN)).toEqual({ kind: 'no_price' });
  });

  it('within_sts when price ≤ STS', () => {
    const r = classifyBuffer(3500, STS, CUSHION, SN);
    expect(r.kind).toBe('within_sts');
    if (r.kind === 'within_sts') {
      expect(r.stsRemaining).toBe(STS - 3500);
    }
  });

  it('within_cushion: ₹35K laptop over STS by ₹8,468 → buffer-after ₹41,532, 1 month rebuild', () => {
    const r = classifyBuffer(35000, STS, CUSHION, SN);
    expect(r.kind).toBe('within_cushion');
    if (r.kind === 'within_cushion') {
      expect(r.drawdown).toBe(8468);             // 35000 − 26532
      expect(r.bufferBefore).toBe(50000);
      expect(r.bufferAfter).toBe(41532);         // 50000 − 8468
      expect(r.monthsToRebuild).toBe(1);         // ceil(8468 / 26532) = 1
    }
  });

  it('within_cushion: purchase at the cushion edge → buffer-after ₹0', () => {
    const r = classifyBuffer(STS + CUSHION, STS, CUSHION, SN);
    expect(r.kind).toBe('within_cushion');
    if (r.kind === 'within_cushion') {
      expect(r.bufferAfter).toBe(0);
      expect(r.drawdown).toBe(CUSHION);
    }
  });

  it('breaches_floor: ₹85K laptop over STS+cushion (₹76,532) by ₹8,468', () => {
    const r = classifyBuffer(85000, STS, CUSHION, SN);
    expect(r.kind).toBe('breaches_floor');
    if (r.kind === 'breaches_floor') {
      expect(r.spendableAboveFloor).toBe(STS + CUSHION);
      expect(r.overBy).toBe(85000 - (STS + CUSHION));
      expect(r.safetyNet).toBe(SN);
    }
  });

  it('breaches_floor: ₹1L Apple Watch is well over STS+cushion', () => {
    const r = classifyBuffer(100000, STS, CUSHION, SN);
    expect(r.kind).toBe('breaches_floor');
  });

  it('cushion_unavailable when cushion = 0 (Spec 3 #5 — feature dormant)', () => {
    const r = classifyBuffer(35000, STS, 0, SN);
    expect(r.kind).toBe('cushion_unavailable');
    if (r.kind === 'cushion_unavailable') {
      expect(r.stsExceedBy).toBe(35000 - STS);
    }
  });

  it('cushion_unavailable: cushion=0 path still fires even for tiny exceedance', () => {
    const r = classifyBuffer(STS + 1, STS, 0, SN);
    expect(r.kind).toBe('cushion_unavailable');
  });

  it('within_sts trumps cushion logic even when cushion is small', () => {
    const r = classifyBuffer(1000, STS, 100, SN);
    expect(r.kind).toBe('within_sts');
  });

  it('monthsToRebuild always at least 1 (no zero-month answers)', () => {
    // Tiny drawdown of ₹100; ceil(100/26532) → would be 1 anyway.
    const r = classifyBuffer(STS + 100, STS, CUSHION, SN);
    expect(r.kind).toBe('within_cushion');
    if (r.kind === 'within_cushion') {
      expect(r.monthsToRebuild).toBeGreaterThanOrEqual(1);
    }
  });
});
