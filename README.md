# Savio

> A conversational AI financial decision companion for in-between-income earning Indians (Tier 1/2 cities, ₹40K–1.2L/month). Built as a PM portfolio piece — a rebuild of a HelloPM cohort group project.

**Live demo:** [savio-financial-app.netlify.app](https://savio-financial-app.netlify.app/)

---

## What it is

Most personal-finance apps intervene **at the moment of decision** — pop a warning when you're about to overspend, block a transaction, nudge you mid-checkout. Savio's thesis is that these moments are the worst time to ask someone to think.

Savio intervenes at **book-ending moments** instead: the monthly ritual when income lands, the windfall the moment it hits, the post-purchase reflection a few days later. Each one is a quieter, slower moment where the user can actually weigh a decision against their stated rules and goals — and where an AI co-pilot can be useful without being annoying.

The product translates raw financial data into **felt consequence**, not financial-advisor abstractions. Verdicts cite the user's own rules by name ("over your impulse-wait threshold of ₹3,000"). Close-out shows a deficit alongside a constructive path tied to the user's own safety-net and impulse-wait values. Chat returns structured cards with green/yellow/red signal + tradeoffs + best-next-step.

---

## Quick links

- 🔗 **[Live demo](https://savio-financial-app.netlify.app/)** — click "Continue as Priya," no registration needed
- 📖 **[PM_DECISIONS.md](./PM_DECISIONS.md)** — every product decision documented (~100KB; the case-study source of truth)
- 📋 **[docs/v2-inventory.md](./docs/v2-inventory.md)** — what's deferred to V2, what's a known limitation, what was rejected (the three-tier discipline)
- 🛠️ **[CLAUDE.md](./CLAUDE.md)** — the engineering context document for the AI agent collaborating on this build

---

## The demo

Open the live URL above and click **"Continue as Priya"** on the Welcome screen — you'll land in Priya Sharma's seeded financial state: ₹98,000 net income, 13 fixed commitments (rent / EMIs / SIPs / utilities), 3 active goals (Phone fund / Emergency fund / Goa trip), ~600 transactions across 6 months, two pending windfalls (Diwali bonus + tax refund).

**Five-minute walkthrough:**

1. **Home** — Safe to spend daily this month + fixed commitments on track + windfall card + goals tracker
2. **Chat** — Send *"Can I afford a ₹3,500 watch?"* → verdict card with rule-citation badges, body explaining the math + the impulse-wait rule by name
3. **Reflect** — Label any unlabeled transactions, tap "Show my reflections" → 4s loading with rotating copy → emotion line chart + tap-to-expand per-merchant trend cards behind "Know more"
4. **Profile → Reviewer tools → Preview March close-out (deficit demo)** — see the "Where we can help next" guidance card with a four-paragraph constructive analysis (names driver merchants, cites the impulse-wait rule by value, suggests a tighter threshold, points to Reflect labeling)
5. **Monthly ritual** — 7-screen close-out + setup flow, with the math-reveal recap card showing income → commitments → goals → variable category net → one-off spending = net leftover

If the cold-start AI calls feel slow on the first chat or first "Show my reflections," that's Vertex JWT mint latency (~6-15s on cold isolates); warm calls are 2-4s.

---

## Tech stack

- **Frontend:** React 19 + TypeScript + Vite 8 + Tailwind
- **Backend:** Supabase (Postgres with RLS + Auth + Edge Functions on Deno)
- **AI:** Vertex AI Gemini 2.5 Flash, accessed via service-account JWT → OAuth Bearer pattern (`supabase/functions/_shared/gemini.ts`)
- **Deploy:** Netlify (frontend) + Supabase (everything else)
- **Discipline:** ESLint with custom rule banning `new Date()` outside `src/lib/dates.ts` (Phase 1 `DEMO_TODAY` pinning), `tsc` clean as a verification gate, 50+ PM_DECISIONS amendments tracking every product call with rationale

---

## Status

Phase 3 complete (tag [`phase-3-complete`](https://github.com/ritikadas98/Savio/releases/tag/phase-3-complete), 2026-05-28). Post-tag streams 0.5o through 0.5v shipped — adding rule citation in verdicts, chart-based Reflect surface, math-reveal close-out recap, "Where we can help next" constructive deficit guidance, and the user-rules schema. **50+ commits since the tag.**

Phase 3 functionally done; case study writeup (per PM_DECISIONS C.24) is the only remaining work.

---

## Project structure

```
src/
├── pages/             # Top-level routes (HomePage, ChatPage, ReflectPage, GoalsPage, ProfilePage, OnboardingPage)
├── components/        # Per-feature components (home, chat, reflect, ritual, windfall, layout, profile)
├── lib/               # Shared business logic (dates, safeToSpend, user-rules, reflect-patterns, guidance, supabase)
└── App.tsx            # Routes

supabase/
├── functions/         # Edge Functions (chat-respond, ritual-close-out, onboarding-synthesize, ...)
├── migrations/        # Schema + seed (0001–0019)
└── _shared/           # Code shared across Edge Functions (gemini.ts, user-rules.ts)

scripts/
├── apply-migrations.js    # Reset DB + reseed
├── test-chat-7cases.mjs   # 9-case chat audit (eyeball-verified)
└── doc1.1-verify.mjs      # Seed sanity check

docs/
├── v2-inventory.md            # Tier 1/2/3 inventory
├── savio_preview.jsx          # Canonical visual reference
└── savio_onboarding.jsx       # Onboarding walkthrough reference

PM_DECISIONS.md        # The case-study source of truth (~100KB, 130+ entries)
CLAUDE.md              # Engineering context document for the AI agent collaborator
```

---

## Running locally

```bash
# Prerequisites: Node 22 (.nvmrc pinned)
nvm use   # or install Node 22 manually

npm install
npm run dev   # → http://localhost:5173
```

You'll also need a `.env.local` with Supabase + Vertex credentials — see `.env.example` for the shape. The `DEMO_PRIYA_PASSWORD` and AI integrations need server-side keys; without them, the bundle still builds but auth / chat / Reflect AI won't function.

For deploying to your own Netlify + Supabase project, see the deploy steps documented in [PM_DECISIONS.md](./PM_DECISIONS.md) (search for "Netlify").

---

## Built by

Ritika Das — PM in transition, building a portfolio that demonstrates how AI agents and a single PM can ship a multi-stream financial product with traceable decision discipline. [LinkedIn / personal site — add link here]

Built in collaboration with Claude Code (Anthropic) as the agent partner. Every product decision banked in `PM_DECISIONS.md` carries the rationale a hiring manager could audit.

---

## License

MIT — see [LICENSE](./LICENSE).
