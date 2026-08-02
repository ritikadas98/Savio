# Savio Project — Context for Claude Code

## What this is

Savio is a PM portfolio project. It's a conversational AI financial decision companion for in-between-income earning Indians (Tier 1/2 cities, ₹40K–1.2L/month). The product helps users translate raw financial data into felt consequence at book-ending moments (monthly anchor, windfall arrival, post-purchase reflection) — NOT at the moment of decision.

The owner (Ritika) is a PM in transition, not an engineer. She directs the agent; the agent does the actual code work. She values:
- PM framing first (user impact, demo behavior, case-study story) before engineering depth
- Decisive recommendations over hedged option-lists
- Honest acknowledgment of what works vs what doesn't — no claiming completion based on intent

## Current state

**Phase 3 complete** (tag `phase-3-complete`, 2026-05-28). Demo user: Priya, Strategist archetype, May 1 2026 state.

- **Phase 1 (Foundation):** COMPLETE. Schema deployed, Priya seeded, Edge Functions deployed. Edge Functions on Vertex AI (`supabase/functions/_shared/gemini.ts` mints OAuth Bearer from service-account JWT).
- **Phase 2 (Home + Chat):** COMPLETE — tagged `phase-2-complete` on commit `00ddfc6`. 7/7 chat audit passing.
  - **Phase 2.9 / 2.95:** primitives, dynamic DEMO_TODAY pinned to 1st-of-month IST.
- **Phase 3 (Surfaces + AI + Onboarding):** COMPLETE.
  - **B1** Profile expansion · **B2 v2** Reflect hybrid (labeling + patterns) · **B3** Goals
  - **C1** Monthly Ritual 7-screen (close-out 3 + setup 4) · **C2** WindfallFlow · **C3** Verdict Cards · **C4** Onboarding walkthrough (11 surfaces)
  - **0.5j-n** polish streams: AI Reflect patterns + race fix + manual refresh, Windfall slider invariant, verdict alignment, prose path Card chrome + new labels, Profile localStorage avatar + life stage
  - **D** Phase D audit + Migration 0017 ritual hardening + lint sweep 73 → 22 + PM_DECISIONS batch
- **Banked for post-delivery (not in `phase-3-complete`):**
  - **C.23** Divergence test artifact (`scripts/run-divergence-tests.mjs` + `docs/divergence-tests.md`)
  - **C.24** Case study writeup
- **Next:** V2 planning. No active phase.

## Key project documents

- `PM_DECISIONS.md` — product opinions + locked decisions; case-study source of truth. Two sections: Foundation Decisions (Stream 0/0.5 era, banked 2026-05-27) and Phase 3 Build Decisions (per-phase A/B/C/D work, banked 2026-05-28). Cite as "Phase 3 Build C.7" / "Foundation C.1" to disambiguate.
- `phase3_completion_plan_master.md` — master plan; section 2 has locked decisions
- `docs/savio_preview.jsx` — canonical visual reference (home / chat / reflect / goals)
- `docs/savio_onboarding.jsx` — canonical onboarding reference (11-step walkthrough, Phase C4)
- `docs/credifyx_behance_reference/` — Behance source imagery
- `docs/divergence-tests.md` — TBD post-delivery per C.23 (not built yet)
- `docs/case-study.md` — TBD post-delivery per C.24 (not built yet)

## What lives where

- Architecture decisions: `PM_DECISIONS.md`
- Verification scripts: `scripts/phase*-check.mjs`, `scripts/phase05*.mjs`, `scripts/gate3-ritual-walkthrough.mjs`, `scripts/doc1.1-verify.mjs`, `scripts/test-chat-7cases.mjs`
- Migrations: `supabase/migrations/` (latest 0017 — ritual hardening: legacy completed_at backfill + complete_monthly_setup precondition)
- Edge Functions deployed: `chat-respond` (verdict + prose-structure layers), `synthesize-patterns` (Reflect AI), `onboarding-synthesize` (Step 8 Ready), `ritual-close-out`, `gemini-test`

## Demo user — Priya Sharma

- Email: `priya@savio.demo`
- Password in `.env.local` as `DEMO_PRIYA_PASSWORD`
- Avatar: Strategist (math-forward voice)
- Life stage: Supporting dependents
- Income: ₹98,000 net (gross ₹1,25,000), paid 1st of month — raised from ₹68,500 in Stream 0.5t D.47 to give Priya realistic discretionary room
- 13 commitments (monthly outflow ≈ ₹62,468)
- 3 goals (Phone fund, Emergency fund, Goa trip)
- ~600 transactions across 6 months ending around DEMO_TODAY (seed is relative to `v_demo_today`, which `apply-migrations.js` auto-pins to the 1st of the current calendar month)
- 5 pre-labeled reflections (Myntra 100% regret rate, Amazon 0%)
- 2 pending windfalls (Diwali bonus ₹50,000, tax refund ₹6,200) — the home dashboard shows whichever has the more recent `detected_at`; the other is queued
- 4 monthly_rituals rows: Jan/Feb/Mar 2026 completed, **previous-month pending** (which month is "previous" depends on when the seed was last run — in any month X, the seed has X-1 pending so the monthly ritual flow has a legitimately closeable past). Note: completed rituals currently have `completed_at = NULL`; the seed has never populated it. Phase 3 ritual close-out write will need to set this.

## Critical rules (do not break)

1. **DEMO_TODAY pinning.** All date math reads from `src/lib/dates.ts`. `DEMO_TODAY` is **computed dynamically** at module load by `computeDemoToday()` to "1st of current real-world calendar month at 9:00 AM IST" (via `Intl.DateTimeFormat` with `timeZone: 'Asia/Kolkata'` so the frontend and Edge Function agree regardless of host timezone). ESLint blocks `new Date()` anywhere outside `dates.ts`. The same `computeDemoToday()` pattern is mirrored in `supabase/functions/chat-respond/prompt_builder.ts` for the Edge Function side. Anywhere else in the app, use `today()` or other helpers from `dates.ts`.

2. **Relative-date seed.** In `0006_seed_priya.sql`, all timestamps must be computed relative to `v_demo_today`. No hardcoded ISO timestamps. `scripts/apply-migrations.js` auto-substitutes the `v_demo_today` literal with "1st of current calendar month (IST)" before applying the seed — so re-running the migration script after a month rollover produces a world anchored to the new month without manual edits. The hardcoded goal `target_date` values (e.g. Phone fund 2026-08-01) are semantically absolute and intentionally do NOT shift with `v_demo_today`.

3. **Filtered grounding context (Divergence #2).** The chat Edge Function's prompt builder must omit empty fields from the system prompt, not include them as "Income: not provided." Test: a profile with only one field set should produce a prompt that mentions only that field.

4. **Phone-shell wrapper.** Every authenticated route renders inside `src/components/layout/PhoneShell.tsx`. On desktop, the app shows as a centered phone frame with black bezel on a grey backdrop. On mobile, it fills the screen.

5. **RLS pattern.** The seed inserts Priya's profile with `profile.id` as a hardcoded UUID and `profile.auth_user_id` as the real auth.users.id. Child tables (`commitments`, `goals`, `transactions`, etc.) use `user_id = profile.id`. RLS policies must JOIN through profiles:
   ```sql
   USING (
     EXISTS (
       SELECT 1 FROM profiles
       WHERE profiles.id = <child_table>.user_id
       AND profiles.auth_user_id = auth.uid()
     )
   )
   ```

6. **Single Edge Function for chat.** Don't chain `classify-intent` + `generate-response`. One function (`chat-respond`) does grounding context + system prompt + Vertex AI `generateContent` call + hallucination guard + scope filter inline. The Vertex call goes through `supabase/functions/_shared/gemini.ts` (JWT-sign with the service-account private key from `GCP_SA_JSON` → exchange for OAuth Bearer → call `{region}-aiplatform.googleapis.com`). No code path to the old Direct Gemini API remains. Latency target: median < 5s on warm isolates; cold paths run ~6-9s due to JWT mint.

7. **No service role on the frontend.** Edge Functions use the user's JWT to create their Supabase client. RLS does the user isolation. Service role stays server-side only.

8. **No streaming `localStorage` in artifacts.** Persisted data lives in Supabase. Frontend uses React state for in-session data only.

## Build mode classifications

Every feature is one of three modes — be explicit about which:
- **`[REAL]`** — fully functional end-to-end. Chat AI, home dashboard, safe-to-spend calc, hallucination guard, scope filter, Goals CRUD.
- **`[PRESENTATIONAL]`** — clickable, persists, simplified backend. Monthly ritual, windfall ritual, reflection labeling, profile.
- **`[DOCUMENTED-FAKE]`** — UI surface with honest "demo mode — V2" note. Statement upload, SMS permission, bank-connect, manual categorization queue.

## Verification expectations

Before claiming any task complete:

1. Run `npm run dev` — confirm zero terminal errors AND zero Vite browser overlay errors.
2. Run `npx tsc --noEmit` — confirm zero TypeScript errors.
3. If the change affects data flow, run the actual SQL query that the UI would run, confirm it returns the expected rows.
4. If the change affects UI, describe what would be visible on screen — explicit values, layout, where each component sits. Ritika takes the actual screenshot to verify.
5. Report what was changed AND what was tested. Don't claim "all criteria implemented" — describe what you actually verified.

## Anti-patterns (we've hit these and don't want to again)

- Claiming Edge Functions are "deployed" without actually running `supabase functions deploy`
- JSX template literals with escaped backticks (`\``) and escaped dollar signs (`\${`) — these aren't valid JS escape sequences
- Hardcoded ISO timestamps in the seed when relative intervals were specified
- Components with ₹0 placeholders instead of actual data queries
- "All N criteria integrated" claims when the app doesn't compile
- Building UI components without wiring up the Supabase queries that populate them

## How to receive tasks from Ritika

Tasks come as focused fix messages — usually one problem per message with explicit verification gates. Don't expand scope beyond what's asked. If you spot something else broken, mention it briefly but don't fix it as part of the same task.

When reporting back, include:
- What you changed (files modified, key code)
- What you tested (commands run, SQL queries verified)
- What's left ambiguous or needs Ritika's manual screenshot verification

Ritika takes the visual screenshots; she verifies the UI looks right. Your job is to make sure the code is correct and the data flows.
