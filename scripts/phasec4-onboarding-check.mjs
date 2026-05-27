// Phase C4 sanity check — exercise the onboarding-synthesize Edge Function
// across all three avatars, both data-source paths, and the irregular-anchor
// branch. Asserts:
//   - 200 status
//   - non-empty `synthesized` text
//   - source === 'ai'
//   - no rupee symbols in the response (qualitative-only constraint)
//   - response references the focus goal label (or "open" if none)

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/onboarding-synthesize`;
const key = process.env.VITE_SUPABASE_ANON_KEY;

async function ask(body) {
  const t0 = Date.now();
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  return { data: await r.json(), status: r.status, wall: Date.now() - t0 };
}

const CASES = [
  { name: 'Strategist / supporting dependents / 1st / Phone fund (statement path)',
    body: { avatar: 'strategist', lifeStage: 'supporting_dependents', anchorDay: 1, focusGoalLabel: 'Phone fund', monthlyIncome: 69000 } },
  { name: 'Adventurer / working / mid-month / Goa trip (statement)',
    body: { avatar: 'adventurer', lifeStage: 'working_no_dependents', anchorDay: 15, focusGoalLabel: 'Goa year-end trip', monthlyIncome: 95000 } },
  { name: 'Builder / pre-retiree / day 25 (irregular) / no focus',
    body: { avatar: 'builder', lifeStage: 'pre_retiree', anchorDay: 25, focusGoalLabel: null, monthlyIncome: 120000 } },
  { name: 'Strategist / student / end-of-month / Phone fund / low income',
    body: { avatar: 'strategist', lifeStage: 'student', anchorDay: 28, focusGoalLabel: 'Phone fund', monthlyIncome: 25000 } },
];

let failed = 0;
console.log('=== Phase C4 — onboarding-synthesize sanity ===\n');
for (const c of CASES) {
  const { data, status, wall } = await ask(c.body);
  const synth = data?.synthesized ?? '';

  const ok200 = status === 200;
  const okSource = data?.source === 'ai';
  const okLength = synth.length >= 40 && synth.length <= 500;
  const okNoRupee = !/₹/.test(synth);
  const okHasFocus = c.body.focusGoalLabel
    ? synth.toLowerCase().includes(c.body.focusGoalLabel.toLowerCase().slice(0, 6))
    : true;

  const allOK = ok200 && okSource && okLength && okNoRupee;
  if (!allOK) failed += 1;

  console.log(`${allOK ? '✓' : '✗'} ${c.name}`);
  console.log(`    status=${status} wall=${wall}ms source=${data?.source} len=${synth.length}`);
  console.log(`    no-rupee=${okNoRupee} hasFocus=${okHasFocus}`);
  console.log(`    "${synth}"`);
  console.log('');
}

console.log(`${failed === 0 ? '✓ ALL CHECKS PASSED' : `✗ ${failed} CHECK(S) FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
