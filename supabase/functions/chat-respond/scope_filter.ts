// Scope filter: deflects investment-advice queries to expert handoff.
// Only inspects the user message — NOT the AI response — so that an in-scope
// answer (e.g. safe-to-spend) that happens to mention a flagged term in passing
// doesn't get its own answer suppressed.

export type ScopeFilterFamily = 'instruments' | 'providers' | 'timing' | 'tax';

export interface ScopeFilterMatch {
  triggered: boolean;
  family: ScopeFilterFamily | null;
}

const PATTERNS: Record<ScopeFilterFamily, RegExp[]> = {
  // Specific investment instruments. "phone fund" / "emergency fund" are
  // user-defined goals and must NOT match — that's why "fund" is only matched
  // when preceded by "mutual"/"gold"/"index"/"debt"/"equity" etc.
  instruments: [
    /\bELSS\b/i,
    /\bmutual\s+funds?\b/i,
    /\bindex\s+funds?\b/i,
    /\bdebt\s+funds?\b/i,
    /\bequity\s+funds?\b/i,
    /\bSIP\b/,
    /\bstocks?\b/i,
    // "share(s)" only when not part of "share my screen / the file / your location / with me" etc.
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
    // Indices — market-index questions
    /\bNIFTY\b/i,
    /\bSENSEX\b/i,
    // FDs only when "fixed deposit" is spelled out OR clearly financial context
    /\bfixed\s+deposits?\b/i,
  ],

  // Specific brokerage / platform names
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

  // Market timing questions
  timing: [
    /\bbest\s+time\s+to\s+(?:invest|buy|sell)\b/i,
    /\bmarket\s+(?:timing|crash|rally|correction|dip)\b/i,
    /\bshould\s+I\s+(?:buy|sell|exit)\b(?:.{0,40}?\b(?:now|today|tomorrow|this\s+week|stocks?|shares?|NIFTY|SENSEX)\b)?/i,
    /\bwhen\s+(?:to|should\s+I)\s+(?:invest|buy|sell)\b/i,
    /\bnow\s+is\s+a\s+good\s+time\b/i,
    /\bwait\s+until\b/i,
  ],

  // Tax regime questions
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

export function checkScopeFilter(userMessage: string): ScopeFilterMatch {
  for (const family of Object.keys(PATTERNS) as ScopeFilterFamily[]) {
    for (const pattern of PATTERNS[family]) {
      if (pattern.test(userMessage)) {
        return { triggered: true, family };
      }
    }
  }
  return { triggered: false, family: null };
}

export function buildScopeDeflection(family: ScopeFilterFamily): string {
  const topic =
    family === 'tax' ? 'tax strategy'
    : family === 'timing' ? 'market timing'
    : 'investment advice';
  return `That's outside what I can help with. For ${topic}, you'd want a SEBI-registered advisor / CA / qualified professional. What I CAN help with is analyzing how your current commitments affect your monthly safe-to-spend.`;
}
