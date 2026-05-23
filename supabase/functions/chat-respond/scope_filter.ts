export function applyScopeFilter(response: string, userQuery: string) {
  const instruments = /\b(ELSS|PPF|NPS|ETF|FD|fixed\s*deposits?|mutual\s*funds?|equity|debt\s*funds?)\b/i;
  const providers = /\b(Zerodha|Groww|HDFC\s*MF|ICICI\s*Direct|Kuvera|Coin|INDmoney)\b/i;
  const timing = /\b(now\s*is\s*a\s*good\s*time|wait\s*until|market\s*dip|buy\s*now|sell\s*now)\b/i;
  const tax = /\b(80C|80D|HRA|old\s*regime|new\s*regime|ITR|tax\s*saving)\b/i;

  const combinedMatch = (text: string) => {
    if (instruments.test(text)) return 'instruments';
    if (providers.test(text)) return 'providers';
    if (timing.test(text)) return 'timing';
    if (tax.test(text)) return 'tax';
    return null;
  };

  const match = combinedMatch(response) || combinedMatch(userQuery);

  if (match) {
    const topic = match === 'tax' ? 'tax strategy' : (match === 'instruments' || match === 'providers' ? 'investment advice' : 'market timing');
    return {
      triggered: true,
      family: match,
      finalResponse: `That's outside what I can help with. For ${topic}, you'd want a SEBI-registered advisor / CA / qualified professional. What I CAN help with is analyzing how your current commitments affect your monthly safe-to-spend.`
    };
  }

  return { triggered: false };
}
