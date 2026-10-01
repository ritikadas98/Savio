// The prompt and the card enforcement both read verdictForMessage, so this
// checks the colour the model is told for Priya's canonical numbers.
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, verdictForMessage } from '../../supabase/functions/chat-respond/prompt_builder';

const profile = {
  full_name: 'Priya Sharma', avatar: 'strategist', monthly_income_net: 98000, anchor_day_of_month: 1,
  safety_net: 100000, impulse_wait_threshold: 3000, impulse_wait_hours: 48, daily_sps_floor: 300,
  unearmarked_liquid: 50000,
};
const goals = [
  { label: 'Phone fund', status: 'active', monthly_contribution: 4000, current_amount: 8000, target_amount: 35000 },
  { label: 'Goa trip', status: 'active', monthly_contribution: 3000, current_amount: 3000, target_amount: 25000 },
  { label: 'Emergency fund', status: 'active', monthly_contribution: 2000, current_amount: 184000, target_amount: 300000, backs_safety_net: true },
];
const commitments = [
  { label: 'Fixed', amount: 47468, category: 'Housing', kind: 'fixed' },
  { label: 'SIPs', amount: 15000, category: 'Investing', kind: 'fixed' },
];
// Same totals, with the variable budgets split out (they sit inside safe-to-spend).
const withBudgets = [
  ...commitments,
  { label: 'Groceries', amount: 6000, category: 'Groceries', kind: 'variable' },
  { label: 'Eating out', amount: 5500, category: 'Food', kind: 'variable' },
  { label: 'Transport', amount: 5500, category: 'Transport', kind: 'variable' },
];
const windfalls = [{ amount: 50000, status: 'pending_allocation' }, { amount: 6200, status: 'pending_allocation' }];
const colour = (m: string) => verdictForMessage(profile, goals, commitments, 0, m).verdict?.color ?? null;

describe('verdictForMessage on Priya', () => {
  it('both watches YELLOW, small spend GREEN, big spend RED', () => {
    expect(colour('Can I afford a ₹5,000 watch?')).toBe('YELLOW');
    expect(colour('What about an ₹8k watch?')).toBe('YELLOW');
    expect(colour('8k ka watch le lu?')).toBe('YELLOW');
    expect(colour('Can I afford a ₹500 lunch?')).toBe('GREEN');
    expect(colour('On top of this ₹8k watch I also want a ₹1,00,000 Apple Watch.')).toBe('RED');
    expect(colour('How am I doing?')).toBeNull();
  });
  it('the prompt tells the model the code colour', () => {
    const p = buildSystemPrompt(profile, goals, commitments, [], null, [], 0, 'Can I afford a ₹5,000 watch?');
    expect(p).toContain('Use verdict_color = "YELLOW"** — decided in code (over the impulse-wait threshold)');
  });
});

describe('card lines written by code', () => {
  it('₹76,533 bike: fund falls by ₹1, not by the full price (the R1 bug)', () => {
    const { verdict, written } = verdictForMessage(profile, goals, commitments, 0, 'Can I afford a ₹76,533 bike?');
    expect(verdict?.color).toBe('RED');
    expect(written?.tradeoffs).toContain('Your Emergency fund falls from ₹1,84,000 to ₹1,83,999.');
  });
  it('earbuds added to a phone: judged on ₹30,000, YELLOW (was RED from the model)', () => {
    const r = verdictForMessage(profile, goals, commitments, 0, 'Add a ₹10,000 pair of earbuds to that.', ['Can I afford a ₹20,000 phone?']);
    expect(r.verdict?.color).toBe('YELLOW');
    expect(r.combined).toBe(true);
    expect(r.written?.tradeoffs).toContain('Drops your cushion from ₹50,000 to ₹46,532 (drawdown of ₹3,468).');
    expect(r.written?.tradeoffs?.[0]).toBe('Your Phone fund already has ₹8,000 saved (target ₹35,000) for this.');
  });
  it('in budget: code adds what is free after the monthly budgets, and a dated next step', () => {
    const w = verdictForMessage(profile, goals, withBudgets, 0, '₹8k watch: yes or no?').written!;
    expect(w.prepend?.[0]).toBe('After your ₹17,000 of monthly budgets (groceries, eating out, transport), ₹1,532 is free this month.');
    expect(w.best_next_step).toMatch(/^Wait 48 hours, until \d+ \w+\. If you still want it then, buy it: ₹1,532 stays free/);
    expect(w.tradeoffs).toBeUndefined();          // the model's own lines stay, after the code ones
  });
  it('the bike ₹1 over: no false "below your safety net" claim', () => {
    const w = verdictForMessage(profile, goals, commitments, 0, 'Can I afford a ₹76,533 bike?').written!;
    expect(w.verdict_line).toBe('Step back — this would take ₹1 out of your Emergency fund, money kept for emergencies.');
    expect(w.best_next_step).toMatch(/^Skip this for now\./);
  });
  it('a ₹2L bike really does go below it, and says so', () => {
    const w = verdictForMessage(profile, goals, commitments, 0, 'Can I buy a ₹2L bike this month?').written!;
    expect(w.verdict_line).toBe('Step back — this would take your Emergency fund ₹39,468 below your ₹1,00,000 safety net.');
  });
  it('states what the records show when the user claims another income', () => {
    const w = verdictForMessage(profile, goals, commitments, 0, 'I earn ₹2,00,000 now. Can I afford a ₹50,000 laptop?', [], windfalls).written!;
    expect(w.tradeoffs?.[0]).toMatch(/^Your records show ₹98,000 take-home, not ₹2,00,000/);
    expect(w.tradeoffs?.join(' ')).toContain('₹56,200 in windfalls not yet assigned');
  });
  it('answers a payday question', () => {
    const w = verdictForMessage(profile, goals, commitments, 0, 'Should I wait until payday to buy a ₹4,000 jacket?').written!;
    expect(w.prepend?.join(' ')).toMatch(/Today is payday\. Next month's safe-to-spend will be ₹26,532 again/);
  });
});
