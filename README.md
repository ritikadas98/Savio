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
