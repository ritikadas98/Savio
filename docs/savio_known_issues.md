# Savio — Known Issues Backlog

This document tracks bugs and refinement opportunities identified during Phase 2 testing that have been **deferred** rather than fixed. Each item includes a fix path so it can be addressed in the appropriate later phase.

Last updated: end of Phase 2.

---

## Severity classification

- **🔴 Demo blocker** — would visibly fail during a portfolio review or interview demo
- **🟡 Polish issue** — noticeable but not breaking; should be fixed before public/portfolio publish
- **🟢 Nice-to-have** — minor refinement, optional

---

## Issue 1 — Hallucination guard: number replacement is stubbed

**Severity:** 🟡 Polish

**Symptom:** When the guard detects a hallucinated number, the metadata includes `"corrections": ["Replaced N hallucinatory number (simulated)"]`. The `"(simulated)"` suffix is the agent's honest label for "this part is placeholder" — the guard correctly flags `verified: false`, but the displayed response text still contains the original (wrong) number.

**Evidence:** Chat test "Can I afford a ₹5,000 watch?" — AI said "₹12,000" (a rounded approximation of the real ₹12,032 safe-to-spend). Guard flagged it but didn't replace.

**Impact:** User sees inaccurate numbers in AI responses even when guard correctly identified them. The `verified: false` flag and missing Verified badge do communicate uncertainty, but the displayed number is still wrong.

**Fix path:** Implement actual number-replacement logic in `hallucination_guard.ts`. When a hallucinated number is detected, find the closest matching number in the grounding context (within tolerance) and substitute it in the response string before returning. If no close match exists, fall back to the generic "Let me check that more carefully" message.

**Defer to:** Phase 6 (final polish)

---

## Issue 2 — Hallucination guard tolerance too tight

**Severity:** 🟢 Nice-to-have

**Symptom:** AI rounded ₹12,032 to ₹12,000 in its response — a 0.27% deviation, well within the intended ±2% tolerance. Guard still flagged it as a hallucination.

**Impact:** Reasonable rounding by the model (which improves readability) gets flagged as inaccurate. Inflates the false-positive rate of the guard.

**Fix path:** Audit the tolerance check in `hallucination_guard.ts`. Likely currently doing strict-match or a percentage too tight. Should be: for each number in the AI response, find the closest number in grounding context; if `|response - grounding| / grounding < 0.02`, pass; else flag.

**Defer to:** Phase 6 (5-minute fix)

---

## Issue 3 — Scope filter over-triggers on legitimate questions

**Severity:** 🔴 Demo blocker

**Symptom:** "What's my safe-to-spend?" got the SEBI-handoff response intended for investment-advice questions. Safe-to-spend is core Savio functionality — refusing to answer this looks broken.

**Evidence:** Image 2 from Phase 2 verification screenshots — scope filter incorrectly fired on a non-investment query.

**Impact:** Users asking core questions get refused. Specifically: any question containing the word "spend," "invest," "save," "fund" might match the filter even though the question is in-scope. Hurts the central Savio demo because "safe-to-spend" is the marquee feature.

**Fix path:** Review scope filter patterns in `scope_filter.ts`. Should be precise pattern matching, not broad keyword matching:
- "ELSS", "mutual fund", "stock", "share" → instruments
- "Zerodha", "Groww", "HDFC mutual fund" → providers
- "buy now", "best time to invest", "should I sell" → timing
- "old regime", "new regime", "80C", "tax saving" → tax

Should NOT match:
- "safe to spend", "what's my budget", "am I on track"
- "phone fund" (this is a user-defined goal, not a financial instrument)

**Defer to:** Fix #4 of Phase 2 (do before closing) or early Phase 3

---

## Issue 4 — Verdict detection over-triggers on non-purchase questions

**Severity:** 🟡 Polish

**Symptom:** "Am I on track?" got `is_verdict: true` and the "Save this decision" button. But "Am I on track" is a reflection/status question, not a purchase decision. Verdicts should be explicit purchase choices.

**Evidence:** Image 3 — Save Decision button rendered on a non-verdict response.

**Impact:** Save Decision affordance appears on non-decisions, cluttering `saved_decisions` table with non-decisions. Confuses the conceptual model of what a "decision" is.

**Fix path:** Tighten verdict detection logic. A verdict is a response to an explicit purchase decision question: "Can I afford X?", "Should I buy Y?", "Is Z a good idea?" with a specific item or amount. NOT general "where am I" or "how am I doing" questions. Either:
- Detect verdict intent in the user query before the LLM call (regex/classifier)
- OR detect in the response (must mention a specific amount + decision yes/no)

**Defer to:** Phase 3 (when reflection/ritual logic also touches "what counts as a decision")

---

## Issue 5 — Response truncation / thin responses

**Severity:** 🟡 Polish

**Symptom:** Some responses appear truncated mid-thought. Image 1: "Observation: Priya, let's break down your current monthly allocations to" — ends mid-sentence. Image 3: one-sentence response that doesn't engage the actual question.

**Impact:** Responses feel incomplete or evasive. Hurts perceived quality of the AI assistance.

**Fix path:** Two possible causes:
1. `maxOutputTokens: 400` setting in `chat-respond` Edge Function is too low for complex grounded answers — try 600-800
2. UI rendering is cutting off text mid-flow — check `MessageBubble.tsx` for any character/length limits

Test by running the same prompt with `maxOutputTokens: 800` and comparing.

**Defer to:** Phase 3 or Phase 5

---

## Issue 6 — Long verdict responses get cut off before Save Decision is visible

**Severity:** 🟡 Polish

**Symptom:** "Can I afford a ₹5,000 watch?" produced a multi-paragraph Observation/Stake/Partnership Offer response. In the chat UI, the response visibly extends past the visible area before the "Save this decision" button — the button isn't reachable without scrolling.

**Evidence:** Image 5 — verdict response cut off at bottom, no Save button visible.

**Impact:** Users can't tap Save Decision on long responses without scrolling, which makes the affordance feel hidden or broken.

**Fix path:** In `MessageBubble.tsx`, ensure verdict messages render with the Save Decision button as part of the bubble's bottom edge, with the bubble itself expanding vertically. The chat container should auto-scroll the latest message into view, including its action buttons.

**Defer to:** Phase 5

---

## Issue 7 — Grounding context: goal data may not be injecting properly

**Severity:** 🟡 Polish (potentially 🔴 if it affects the core "AI uses your real data" claim)

**Symptom:** "Am I on track?" returned a generic "Let's break down your financial position to see where you stand" — no specific reference to Priya's actual goals (₹8K of ₹35K phone fund, etc.). Either the goal data isn't being injected into the system prompt, or the AI is ignoring it.

**Impact:** The central architectural claim of Savio is "AI grounded in your actual data." If goal data isn't reaching the prompt, that claim breaks for any goal-related query.

**Fix path:** 
1. Log the actual system prompt sent to Gemini for a goal query in `chat-respond` Edge Function
2. Verify goal data appears in the prompt (look for "Phone fund: ₹8,000 of ₹35,000")
3. If goal data IS present but ignored, sharpen the system prompt's instructions about using grounding context
4. If goal data is NOT present, fix the grounding pipeline in `prompt_builder.ts`

**Defer to:** Phase 3 (when rituals + reflection work also depend on grounded data)

---

## Issue 8 — Save Decision persistence — not yet verified

**Severity:** ⏳ Pending verification

**Symptom:** "Save this decision" button visible in UI (image 3), but no end-to-end test confirming the button writes to `saved_decisions` table.

**Test required:**
1. Send "Can I afford a ₹5,000 watch?"
2. Tap "Save this decision"
3. Run in Supabase SQL editor:
   ```sql
   SELECT decision_text, verdict, amount, decided_at FROM saved_decisions;
   ```
4. Should return one row

**Action:** Run this 2-minute test before truly closing Phase 2. If passes, remove this item. If fails, this becomes a 🔴 demo blocker for Phase 2 close-out.

---

## Phase 2 — What IS confirmed working

For balance, here's the positive ledger:

- ✓ Auth flow (sign in as Priya)
- ✓ Home dashboard: 7 cards rendering real seeded data
- ✓ "Welcome back, Priya" (real name from profile.full_name)
- ✓ Safe-to-spend hero: ₹12,032 with rainbow gradient + position marker
- ✓ "April 2026 check-in ready" banner
- ✓ "13/13 paid, all caught up this month" commitments
- ✓ For You Today: real guidance from `guidance.ts` ("Phone fund on track to August", "Regret rate trending down")
- ✓ Recent transactions: 4 most recent with merchant, amount, date, category
- ✓ Page scrolls smoothly, bottom nav stays pinned
- ✓ Phone shell wrapper (mobile-first, frame on desktop)
- ✓ Text contrast across all surfaces
- ✓ Chat empty state with welcome + 4 chips
- ✓ Chat composer at bottom, messages above
- ✓ Compass AI avatar in chat
- ✓ "Verified" badge on grounded responses
- ✓ "Save this decision" button on verdict responses
- ✓ Chat history persists to `chat_messages` table
- ✓ Latency ~2.6s server-side (under 3s target)
- ✓ Hallucination guard detects out-of-context numbers
- ✓ Scope filter triggers on investment-advice queries (over-aggressive, see Issue 3)
- ✓ RLS policies allow Priya to see her own data; anonymous sees zero rows
- ✓ DEMO_TODAY pinning, no raw `new Date()` outside `dates.ts`
- ✓ Bottom nav with icons + active state pill across all routes
- ✓ All TypeScript clean (`npx tsc --noEmit` zero errors)
- ✓ All builds clean (`npx vite build` succeeds)

---

## Priority order for known-issues fix-up

When ready to address (likely Phase 3-6 timeline):

1. **Before Phase 2 truly closes:** Issue 3 (scope filter over-triggering — 🔴 demo blocker), Issue 8 (Save Decision persistence verification)
2. **During Phase 3:** Issue 4 (verdict detection), Issue 5 (response truncation), Issue 7 (goal grounding)
3. **During Phase 5 or 6:** Issue 1 (number replacement), Issue 2 (tolerance tightness), Issue 6 (long verdict layout)


Part 2

# Savio — Known Issues & Backlog (Updated)

Last updated: post-Fix #5, Fix #6 pending.

---

## Resolved by Fix #5

- ✅ Hallucination guard now allows derived arithmetic (₹12,032 - ₹5,000 = ₹7,032 passes)
- ✅ Grounding context splits investing vs non-investing commitments
- ✅ Pre-computed safe-to-spend in grounding context with formula
- ✅ Markdown renders correctly in chat bubbles (bold labels)
- ✅ Save Decision button no longer shows on fallback / scope-filter responses
- ✅ "What's my safe-to-spend?" returns grounded answer
- ✅ "Show me where I'm spending" references correct ₹47,468

---

## Open — Fix #6 (immediate, deploying now)

### Issue A — Truncation on analytical queries (cases 4, 5)
**Severity:** Demo blocker
**Root cause:** Gemini thinking-mode tokens consume maxOutputTokens budget
**Fix:** thinkingBudget: 256
**Status:** Fix #6 message ready to send to Claude Code

---

## Deferred — Phase 4 / 5 / 6

### Issue B — Model rounds 12,032 to 12,000
**Severity:** Polish
**Defer to:** Phase 6
**Fix path:** Add "Do not round numerical values" to system prompt NUMBER DISCIPLINE section

### Issue C — Verdict detection over-triggers on "track"
**Severity:** Polish
**Defer to:** Phase 5
**Fix path:** Refine verdict regex to require purchase verb + amount, OR use intent classification

### Issue D — Conversation history contamination across multi-turn sessions
**Severity:** Polish
**Defer to:** Phase 5
**Fix path:** Reduce history window to 2-3 messages, OR add "each response stands alone" instruction

### Issue E — Typography upgrade (NEW)
**Severity:** Polish
**Defer to:** Phase 6
**Reference:** User-provided screenshot showing cleaner sans-serif font, no white bubble on AI messages, generous line height, sage-tinted tip boxes, dark green user bubbles on warm cream canvas.
**Fix path:**
- Replace MessageBubble's white card background for AI messages with transparent (text-only on canvas)
- Switch font stack to modern grotesque (Inter or system sans-serif equivalent)
- Increase line-height to 1.55-1.65
- Style bullet lists with proper `•` markers
- Add `prose-tip` utility for light-sage info boxes with lightbulb emoji pattern

### Issue F — Conversational data mutation pattern (NEW — major feature)
**Severity:** Feature, not bug
**Defer to:** Phase 4 or Phase 5
**Reference:** User-provided screenshot showing "SAFETY BUFFER UPDATE" card with Confirm/Decline buttons after user states corrective fact ("my current buffer is 20k").

**What this enables:**
Users can update underlying data (safety buffer floor, monthly income, goal targets, commitment amounts) through natural language. AI detects update intent, generates a structured confirmation card, persists on confirm.

**Architecture required:**
1. Intent classifier (in `chat-respond` Edge Function): distinguish question vs update vs verdict
2. New UI component: `UpdateProposalCard` with title, field/value display, Confirm/Decline buttons, "Needs confirmation" badge
3. New `chat_messages` row type: `kind = 'update_proposal'` (alongside existing user/assistant)
4. Database mutation logic per update type:
   - Safety buffer → `profiles.safety_buffer_floor`
   - Income → `profiles.net_monthly_income`
   - Goal target → `goals.target_amount`
   - Goal contribution → `goals.monthly_contribution`
   - Commitment amount → `commitments.amount`
5. Confirmation workflow: temp-store proposed value, write on confirm, discard on decline
6. Optimistic UI: dashboard reflects new value immediately on confirm with rollback if write fails

**Case study angle:** "Savio's chat evolves from Q&A surface to conversational mutation interface. Users update goals/buffers through natural language with explicit confirmation step — minimizes friction (no nav to settings) while preserving agency (explicit confirm)."

**Effort estimate:** 4-6 hours of focused build. Worth doing as a Phase 4 standalone feature once the ritual flows are in place.

---

## Path to Phase 2 close-out

After Fix #6 (thinking-token cap):
1. Re-run 7-case audit
2. Expect cases 4 and 5 to flip from FAIL to PASS
3. If 7/7 (or 6/7 with case 4 verdict-detection deferred): **Phase 2 DONE**
4. Plan Phase 3 (rituals + reflection labeling)