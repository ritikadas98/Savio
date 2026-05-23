// Edge function uses Deno

export const buildIdentityLayer = (): string => {
  return `You are Savio, an AI decision-support companion for earning Indians.
You help users translate raw financial data into felt consequences to prime their decision-making.
WHAT YOU ARE NOT:
- You are NOT an investment advisor. Do NOT give specific instrument recommendations (e.g., mutual funds, stocks, ETFs).
- You are NOT a tax planner. Do NOT give tax strategy advice (e.g., 80C, new vs old regime).
- You are NOT a real-time intervention layer blocking purchases.
If a user asks about forbidden topics, you must use the expert handoff pattern:
"That's outside what I can help with. For [topic], you'd want a SEBI-registered advisor / CA / qualified professional. What I CAN help with is [related decision-support topic]."
Do NOT moralize, guilt-trip, or act like a strict parent.
`;
};

export const buildVoiceLayer = (avatar: string): string => {
  switch (avatar.toLowerCase()) {
    case 'strategist':
      return `VOICE RULE (The Strategist):
Your tone is math-forward, precision-oriented, and rule-referenced. The user wants to verify their work and see the math. Use the "Observation -> Stake -> Partnership Offer" pattern.
Be analytical but supportive. Use numbers clearly.`;
    case 'adventurer':
      return `VOICE RULE (The Adventurer):
Your tone is practical, flow-oriented, and cautious only when necessary. The user wants to know if there's a problem, otherwise let them live. Use the "Observation -> Stake -> Partnership Offer" pattern.`;
    case 'builder':
      return `VOICE RULE (The Builder):
Your tone is progress-focused and goal-oriented. The user is working towards something. Show them progress. Use the "Observation -> Stake -> Partnership Offer" pattern.`;
    default:
      return `VOICE RULE (Neutral): Use a calm, helpful, supportive tone.`;
  }
};

export const buildGroundingContext = (
  profile: any,
  goals: any[],
  commitments: any[],
  transactions: any[],
  ritual: any,
  merchantStats: any[]
): string => {
  let context = 'GROUNDING CONTEXT (User Data):\n';
  
  const addIfVal = (label: string, val: any) => {
    if (val !== null && val !== undefined && val !== '') {
      context += `${label}: ${val}\n`;
    }
  };

  context += '--- PROFILE ---\n';
  addIfVal('Name', profile.full_name);
  addIfVal('Life Stage', profile.life_stage);
  addIfVal('Monthly Income (Gross)', profile.monthly_income_gross);
  addIfVal('Monthly Income (Net)', profile.monthly_income_net);
  addIfVal('Anchor Day', profile.anchor_day_of_month);
  
  if (ritual) {
    context += '\n--- THIS MONTH ---\n';
    addIfVal('Safe to spend remaining', ritual.safe_to_spend_locked);
    // find focus goal
    if (ritual.focus_goal_id) {
      const g = goals.find(x => x.id === ritual.focus_goal_id);
      if (g) addIfVal('Focus Goal', g.label);
    }
  }

  if (goals && goals.length > 0) {
    const active = goals.filter(g => g.status === 'active');
    if (active.length > 0) {
      context += '\n--- ACTIVE GOALS ---\n';
      active.forEach(g => {
        addIfVal(`Goal (${g.label}) Target`, g.target_amount);
        addIfVal(`Goal (${g.label}) Current`, g.current_amount);
        addIfVal(`Goal (${g.label}) Monthly Contribution`, g.monthly_contribution);
      });
    }
  }

  if (commitments && commitments.length > 0) {
    context += '\n--- COMMITMENTS ---\n';
    commitments.forEach(c => {
      addIfVal(`Commitment (${c.label})`, c.amount);
    });
  }

  if (merchantStats && merchantStats.length > 0) {
    context += '\n--- MERCHANT STATS ---\n';
    merchantStats.forEach(s => {
      addIfVal(`Merchant (${s.merchant}) Regret Rate`, s.regret_rate ? s.regret_rate + '%' : undefined);
      addIfVal(`Merchant (${s.merchant}) Total TXNs`, s.total_transactions);
      addIfVal(`Merchant (${s.merchant}) Regret Count`, s.regret_count);
    });
  }

  return context;
};

export const buildSystemPrompt = (
  profile: any,
  goals: any[],
  commitments: any[],
  transactions: any[],
  ritual: any,
  merchantStats: any[]
): string => {
  const layer1 = buildIdentityLayer();
  const layer2 = buildVoiceLayer(profile.avatar || 'strategist');
  const layer3 = buildGroundingContext(profile, goals, commitments, transactions, ritual, merchantStats);
  
  return `${layer1}\n\n${layer2}\n\n${layer3}`;
};
