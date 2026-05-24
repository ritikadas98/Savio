// One-shot verification of the 12 scope-filter test cases.
// Mirrors the regex set in supabase/functions/chat-respond/scope_filter.ts.
// If the .ts patterns change, update this script too.

const PATTERNS = {
  instruments: [
    /\bELSS\b/i,
    /\bmutual\s+funds?\b/i,
    /\bindex\s+funds?\b/i,
    /\bdebt\s+funds?\b/i,
    /\bequity\s+funds?\b/i,
    /\bSIP\b/,
    /\bstocks?\b/i,
    /\bshares?\b(?!\s+(?:my|the|your|a|this|that|with|something|some))/i,
    /\bequity\b/i,
    /\bbonds?\b/i,
    /\bdebentures?\b/i,
    /\bIPO\b/i,
    /\bNPS\b/,
    /\bPPF\b/,
    /\bETF\b/,
    /\bcrypto(?:currency)?\b/i,
    /\bbitcoin\b/i,
    /\bgold\s+(?:fund|ETF|bond)s?\b/i,
    /\bNIFTY\b/i,
    /\bSENSEX\b/i,
    /\bfixed\s+deposits?\b/i,
  ],
  providers: [
    /\bZerodha\b/i,
    /\bGroww\b/i,
    /\bUpstox\b/i,
    /\bICICI\s+Direct\b/i,
    /\bHDFC\s+Securities\b/i,
    /\bHDFC\s+MF\b/i,
    /\bKuvera\b/i,
    /\bSmallcase\b/i,
    /\bINDmoney\b/i,
  ],
  timing: [
    /\bbest\s+time\s+to\s+(?:invest|buy|sell)\b/i,
    /\bmarket\s+(?:timing|crash|rally|correction|dip)\b/i,
    /\bshould\s+I\s+(?:buy|sell|exit)\b(?:.{0,40}?\b(?:now|today|tomorrow|this\s+week|stocks?|shares?|NIFTY|SENSEX)\b)?/i,
    /\bwhen\s+(?:to|should\s+I)\s+(?:invest|buy|sell)\b/i,
    /\bnow\s+is\s+a\s+good\s+time\b/i,
    /\bwait\s+until\b/i,
  ],
  tax: [
    /\bold\s+regime\b/i,
    /\bnew\s+regime\b/i,
    /\b80\s*C\b/i,
    /\b80\s*D\b/i,
    /\bsection\s+80\w?\b/i,
    /\btax\s+saving\s+(?:investment|instrument|fund|scheme)s?\b/i,
    /\bHRA\s+exemption\b/i,
    /\bcapital\s+gains?\s+tax\b/i,
    /\bITR\b/i,
  ],
};

function checkScopeFilter(msg) {
  for (const family of Object.keys(PATTERNS)) {
    for (const pattern of PATTERNS[family]) {
      if (pattern.test(msg)) {
        return { triggered: true, family, pattern: pattern.source };
      }
    }
  }
  return { triggered: false, family: null, pattern: null };
}

const CASES = [
  // Must trigger
  { msg: 'Should I invest in ELSS?',           expect: 'trigger', expectedFamily: 'instruments' },
  { msg: 'Is Zerodha a good broker?',          expect: 'trigger', expectedFamily: 'providers'   },
  { msg: 'Should I buy NIFTY today?',          expect: 'trigger', expectedFamily: null /* either instruments(NIFTY) or timing — both acceptable */ },
  { msg: 'Old regime vs new regime for me?',   expect: 'trigger', expectedFamily: 'tax'         },
  { msg: 'Best mutual fund for SIP?',          expect: 'trigger', expectedFamily: 'instruments' },
  { msg: 'How much should I put in PPF?',      expect: 'trigger', expectedFamily: 'instruments' },
  // Must NOT trigger
  { msg: "What's my safe-to-spend?",           expect: 'pass' },
  { msg: 'Am I on track for my phone fund?',   expect: 'pass' },
  { msg: 'Can I afford a ₹5,000 watch?',       expect: 'pass' },
  { msg: 'How much can I save this month?',    expect: 'pass' },
  { msg: "What's my regret rate at Myntra?",   expect: 'pass' },
  { msg: "Show me where I'm spending",         expect: 'pass' },
  { msg: 'Am I doing okay this month?',        expect: 'pass' },
];

let passed = 0, failed = 0;
console.log(`\nScope filter — ${CASES.length} cases\n` + '─'.repeat(60));

for (const c of CASES) {
  const result = checkScopeFilter(c.msg);
  const actuallyTriggered = result.triggered;
  const wantTriggered = c.expect === 'trigger';
  const triggerOK = actuallyTriggered === wantTriggered;
  const familyOK = !wantTriggered || c.expectedFamily === null || result.family === c.expectedFamily;
  const ok = triggerOK && familyOK;
  if (ok) passed++; else failed++;
  const tag = ok ? 'PASS' : 'FAIL';
  const detail = actuallyTriggered
    ? `→ triggered=${result.family} via /${result.pattern}/`
    : '→ passed through';
  console.log(`  [${tag}] ${c.msg}`);
  console.log(`         ${detail}  (expected: ${c.expect}${c.expectedFamily ? '/' + c.expectedFamily : ''})`);
}

console.log('─'.repeat(60));
console.log(`Total: ${passed}/${CASES.length} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
