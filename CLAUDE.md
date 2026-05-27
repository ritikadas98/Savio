# Savio Project — Context for Claude Code

## What this is

Savio is a PM portfolio rebuild of a HelloPM cohort group project. It's a conversational AI financial decision companion for in-between-income earning Indians (Tier 1/2 cities, ₹40K–1.2L/month). The product helps users translate raw financial data into felt consequence at book-ending moments (monthly anchor, windfall arrival, post-purchase reflection) — NOT at the moment of decision.

The owner (Ritika) is a PM in transition, not an engineer. She directs the agent; the agent does the actual code work. She values:
- PM framing first (user impact, demo behavior, case-study story) before engineering depth
- Decisive recommendations over hedged option-lists
- Honest acknowledgment of what works vs what doesn't — no claiming completion based on intent

## Current state

- **Phase 1 (Foundation):** COMPLETE. Schema deployed, Priya seeded, Edge Functions deployed (`chat-respond`, `suggest-windfall-allocation`, `gemini-test`). Edge Functions migrated to Vertex AI on GCP (was AI Studio Direct Gemini API) — Gemini calls auth via service-account JWT → OAuth Bearer token in `supabase/functions/_shared/gemini.ts`.
- **Phase 2 (Home + Chat):** COMPLETE — tagged `phase-2-complete` on commit `00ddfc6`. 7/7 chat audit passing (Case 4 phone-fund has a known pre-existing limitation in the hallucination guard's arithmetic check around date math, deferred to Phase 3+).
  - **Phase 2.9:** Primitives extracted (`Card`, `Pill`, `Row`, `SectionHeader`). Design decisions 1/2/4 from the JSX preview applied (hero size, 4-tab nav with ProfilePill route to /profile, rainbow-gradient Savio avatar). Decision 3 (chat card-with-asymmetric-corners + structured Tradeoffs/Best-next-step blocks) deferred to Phase 5.
  - **Phase 2.95:** DEMO_TODAY now dynamic, pinned to 1st of current real-world month at 9 AM IST. Seed auto-substitutes via `scripts/apply-migrations.js`. Crossing a month boundary requires one re-run of that script.
- **Phase 3+:** Not started. Rituals (ritual flow logic, rollover model, commitment payment tracking), reflection labeling, goals CRUD, profile page proper, structured chat responses, conversational mutation, polish/deploy.

## Key project documents

- `savio-rebuild-build-spec_new.md` — canonical spec, ~1500 lines
- `savio-design-system-spec.md` — visual system, the source of truth (not Appendix B of the build spec, which is stale)
- `savio_prd.md` — strategic PRD with phase sequencing and acceptance criteria

## Demo user — Priya Sharma

- Email: `priya@savio.demo`
- Password in `.env.local` as `DEMO_PRIYA_PASSWORD`
- Avatar: Strategist (math-forward voice)
- Life stage: Supporting dependents
- Income: ₹68,500 net, paid 1st of month
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
