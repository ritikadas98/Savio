# Savio

Better money decisions, made together.

## Phase 1: Foundation (Rebuild)

This branch tracks the Phase 1 Foundation build per `savio-rebuild-build-spec_new.md`.

### Completed Features & Infrastructure
- **Data Model**: Full 10-table schema built and enforced via `pg` migrations (0001–0006). 
- **Demo Seed Data**: Complete state seeded for `priya@savio.demo` using the `DEMO_TODAY` anchor date (April 15, 2026), including 13 commitments, 3 goals, ~600 dynamically shifted transactions, and 2 pending windfalls.
- **Design System**: Fully adopted the Neue Montreal typography and the 3-avatar specific color palette (`canvas`, `strategist`, `adventurer`, `builder`).
- **Auth Bypass**: Welcome screen explicitly implements a demo bypass ("Demo: Log in as Priya") to jump straight into the application state without manual user registration.
- **AI Edge Scaffold**: Deno Edge Function (`suggest-windfall-allocation`) deployed and `/dev/gemini-test` route fully integrated with the Gemini 2.5 Flash API for latency testing.
- **Strict Date Rule**: All `new Date()` calls are restricted to `src/lib/dates.ts` via ESLint to prevent relative-date test drifting.

### Known Weaknesses / Deliberate Scoping
- **Auth Scope**: Only Priya's credentials (priya@savio.demo — password in .env.local) are meant to be used. The registration and dynamic onboarding flow are not built.
- **Statement Parsing**: The PDF statement parsing is simulated and directly seeded in V1.
- **SMS Auto-Detection**: SMS triggers for income and transactions are replaced by pre-seeded mock transactions and direct invocation logic.
- **Edge Function Stubbing**: The `suggest-windfall-allocation` edge function implements a strict percentage-based deterministic fallback and does not dynamically read user-specific rules via LLM yet.

### Deployment

The Edge Functions are deployed directly to Supabase using the CLI. Note that Docker is not required for deployment.
To deploy, authenticate using your Supabase Access Token, and run the following commands:

```bash
export SUPABASE_ACCESS_TOKEN=sbp_b34d6741f8565ecbb512e8c39362fe1bd3aaf6aa
npx supabase functions deploy gemini-test --project-ref lstfbkcghnsoxyxpxnty --no-verify-jwt
npx supabase functions deploy suggest-windfall-allocation --project-ref lstfbkcghnsoxyxpxnty
npx supabase functions deploy chat-respond --project-ref lstfbkcghnsoxyxpxnty
npx supabase secrets set GEMINI_API_KEY=<your_key> --project-ref lstfbkcghnsoxyxpxnty
npx supabase secrets set GEMINI_MODEL_ID=gemini-2.5-flash --project-ref lstfbkcghnsoxyxpxnty
```

## Phase 2 Architecture

Phase 2 introduces the Home Dashboard and the Chat surface. It utilizes a single monolithic Edge Function \`chat-respond\` to deliver low-latency responses with integrated safety rails.

### Safe-to-Spend Formula
The safe-to-spend figure is calculated deterministically to avoid LLM hallucination on core accounting:
\`\`\`
safe_to_spend = monthly_income_net - sum(commitments where category != 'Investing') - sum(active goals' monthly_contribution)
\`\`\`

### Edge Function Guards

#### Hallucination Guard
Runs inline post-generation. It extracts every \`₹X\` and \`X%\` figure from the LLM's response and verifies it against the generated grounding context (within ±2% tolerance). 
- **0 failures**: \`verified: true\` (Displays Verified Badge)
- **1 failure**: Replaces the incorrect number (simulated), \`verified: false\`
- **2+ failures**: Replaces the entire response with a deterministic fallback.

#### Scope Filter
Runs inline post-generation. Uses regex to intercept forbidden topics and replace the response with an expert handoff.
- **Instruments**: ELSS, PPF, NPS, ETF, FD, mutual funds
- **Providers**: Zerodha, Groww, HDFC MF, ICICI Direct, Kuvera, Coin, INDmoney
- **Timing**: "now is a good time", "market dip", "buy now", "sell now"
- **Tax Strategy**: 80C, 80D, HRA, old/new regime, ITR

