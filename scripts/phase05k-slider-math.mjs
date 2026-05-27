// Stream 0.5k — verify the slider rebalance algorithm preserves the
// invariant sum(allocations) === TOTAL across extreme interactions, and
// never overshoots. Mirrors the update() in src/components/windfall/WindfallAllocate.tsx.

function makeUpdate(buckets, TOTAL) {
  return (allocations, key, value) => {
    if (key === 'free') return allocations;  // Free is derivative; no-op.
    const otherNonFreeSum = buckets
      .filter(b => b.key !== key && b.key !== 'free')
      .reduce((s, b) => s + allocations[b.key], 0);
    const maxValue = TOTAL - otherNonFreeSum;
    const clamped = Math.max(0, Math.min(value, maxValue));
    const newFree = TOTAL - clamped - otherNonFreeSum;
    return { ...allocations, [key]: clamped, free: Math.max(0, newFree) };
  };
}

function sum(a) { return Object.values(a).reduce((s, v) => s + v, 0); }

let failed = 0;
function check(name, condition, detail) {
  const ok = condition;
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed += 1;
}

// ------- Case A: Priya 3-bucket, ₹6,200 -------
console.log('=== Case A: Priya 3-bucket, TOTAL=₹6,200 ===');
{
  const TOTAL = 6200;
  const buckets = [
    { key: 'emergency', max: 6200 },
    { key: 'phone',     max: 6200 },
    { key: 'free',      max: 6200 },
  ];
  const update = makeUpdate(buckets, TOTAL);
  let a = { emergency: 2500, phone: 1900, free: 1800 };
  check('initial sums to TOTAL', sum(a) === TOTAL, `sum=${sum(a)}`);

  // Drag emergency to 5000 — phone 1900, so free should drop to 6200 - 5000 - 1900 = -700 → clamp emergency at 4300
  a = update(a, 'emergency', 5000);
  check('after drag emergency→5000: clamped at 4300', a.emergency === 4300, `emergency=${a.emergency}`);
  check('free goes to 0',                              a.free === 0,        `free=${a.free}`);
  check('phone unchanged at 1900',                     a.phone === 1900,    `phone=${a.phone}`);
  check('sum still TOTAL',                             sum(a) === TOTAL,    `sum=${sum(a)}`);

  // Try dragging emergency higher — should not move
  a = update(a, 'emergency', 9999);
  check('emergency cannot exceed 4300 when phone+free=1900+0', a.emergency === 4300);
  check('sum still TOTAL',                                     sum(a) === TOTAL);

  // Reduce phone, then drag emergency higher
  a = update(a, 'phone', 0);
  check('phone→0 valid',                a.phone === 0,        `phone=${a.phone}`);
  check('free absorbs phone delta',     a.free === 1900,      `free=${a.free}`);
  check('sum still TOTAL',              sum(a) === TOTAL);

  a = update(a, 'emergency', 6200);
  check('emergency can max to 6200 now', a.emergency === 6200);
  check('free=0, phone=0',               a.free === 0 && a.phone === 0);
  check('sum still TOTAL',               sum(a) === TOTAL);
}

// ------- Case B: ₹50,000 windfall — original user-reported overshoot scenario -------
console.log('\n=== Case B: ₹50,000 4-bucket (user-reported overshoot) ===');
{
  const TOTAL = 50000;
  const buckets = [
    { key: 'emergency', max: 30000 },
    { key: 'phone',     max: 27000 },
    { key: 'loan',      max: 25000 },
    { key: 'free',      max: 50000 },
  ];
  const update = makeUpdate(buckets, TOTAL);
  let a = { emergency: 20000, phone: 15000, loan: 10000, free: 5000 };
  check('initial sums to TOTAL', sum(a) === TOTAL);

  // Drag emergency to 40000 — old buggy code would produce sum=55000
  a = update(a, 'emergency', 40000);
  check('emergency clamped (not 40000)', a.emergency < 40000, `emergency=${a.emergency}`);
  check('free should be 0',              a.free === 0,        `free=${a.free}`);
  check('sum still TOTAL — NO OVERSHOOT', sum(a) === TOTAL,   `sum=${sum(a)}`);

  // Now drag phone higher
  a = update(a, 'phone', 30000);
  check('phone clamped',                  a.phone < 30000,    `phone=${a.phone}`);
  check('sum still TOTAL',                sum(a) === TOTAL,   `sum=${sum(a)}`);

  // Free direct drag = no-op
  const before = { ...a };
  a = update(a, 'free', 99999);
  check('drag Free up: no-op (snap-back)',   a.free === before.free, `free=${a.free} before=${before.free}`);
  a = update(a, 'free', 0);
  check('drag Free down: no-op (snap-back)', a.free === before.free);
  check('sum still TOTAL',                   sum(a) === TOTAL);
}

// ------- Case C: random fuzzing -------
console.log('\n=== Case C: random fuzz (100 drags, sum invariant must hold every step) ===');
{
  const TOTAL = 6200;
  const buckets = [
    { key: 'emergency', max: 6200 },
    { key: 'phone',     max: 6200 },
    { key: 'free',      max: 6200 },
  ];
  const update = makeUpdate(buckets, TOTAL);
  let a = { emergency: 2500, phone: 1900, free: 1800 };
  let ok = true;
  for (let i = 0; i < 100; i++) {
    const k = buckets[Math.floor(Math.random() * buckets.length)].key;
    const v = Math.floor(Math.random() * (TOTAL + 1000)) - 500;  // include out-of-range values
    a = update(a, k, v);
    if (sum(a) !== TOTAL) { ok = false; console.log(`    fail at step ${i}: ${JSON.stringify(a)}`); break; }
    if (Object.values(a).some(x => x < 0)) { ok = false; console.log(`    negative at ${i}: ${JSON.stringify(a)}`); break; }
  }
  check('100 random drags preserve invariant + no negatives', ok);
}

console.log(`\n${failed === 0 ? '✓ ALL CHECKS PASSED' : `✗ ${failed} CHECK(S) FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
