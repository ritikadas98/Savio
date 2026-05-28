# Savio — V2 Inventory

**Purpose:** Consolidated record of every item not shipped in the Phase 3 Savio MVP, organized by *why* it isn't shipped. This is portfolio-quality material — the "what's not built" story matters as much as the "what is built" story.

**Source:** Compiled from Savio 1 + Savio 2 chat history, PM_DECISIONS.md, and the Phase D audit batch (~50 amendments banked 2026-05-28) + Phase D-followup commits (D.15 auto-reset, D.16 script snapshot/restore) + Stream 0.5o (D.17 auth-gate, D.18 hallucination guard extension, D.19 per-merchant pre-flight finding). Source-first verified — items are cross-checked against actual decisions and live code, not memory.

**Structure:** Three tiers, kept distinct because they mean different things:
- **Tier 1 — Deferred to V2.** Active future-work. Architecture supports it; not shipped because of scope, not because of impossibility.
- **Tier 2 — Known limitations of shipped surfaces.** Things that work, but with documented constraints. The discipline tier.
- **Tier 3 — Rejected permanently.** Not deferred. Out of product as a deliberate choice. The judgment tier.

**Why these three are kept separate:** They demonstrate different PM muscles. Tier 1 = prioritization. Tier 2 = honesty about shipped state. Tier 3 = strategic judgment about what NOT to build.

---

## Tier 1 — Deferred to V2

Items the architecture supports but the MVP doesn't include. Each has a clear path to being built without re-architecting; that's part of the case-study claim.

### Data ingestion

| Item | Current state | V2 work |
|---|---|---|
| Real PDF statement parsing | `[DOCUMENTED-FAKE]` drop zone with hardcoded "parsed" values | OCR + per-bank format library (HDFC, SBI, ICICI minimum) + Gemini normalization |
| Account Aggregator integration | `[DOCUMENTED-FAKE]` Bank-connect option with V2 pill | Sahamati / Finvu / OneMoney integration, real OAuth flow |
| Real Android SMS BroadcastReceiver | `[DOCUMENTED-FAKE]` permission screen with V2 framing | Android permission flow + whitelisted sender parser + on-device classification |
| Manual-categorization learning | Categorization queue is `[DOCUMENTED-FAKE]` | Labels auto-apply to similar future transactions; model retrains per user |

### Detection + scheduling

| Item | Current state | V2 work |
|---|---|---|
| Real windfall outlier detection | Seeded `pending_allocation` rows trigger the flow | Probabilistic detection from transaction stream (above-pattern inflow) |
| N-day-delayed reflection prompts | Reflect surface shows unlabeled transactions on-demand | Scheduled jobs that surface labeling prompts post-purchase |
| Real auth + multi-user with onboarding writes | Single seeded Priya; onboarding is Option D walkthrough-as-demo per C.18 | Supabase anonymous auth + function that copies Priya's seed rows into each new guest's `user_id` |

### Notifications + mobile

| Item | Current state | V2 work |
|---|---|---|
| Real push notifications | In-app banners only | FCM / APNS for ritual reminders + windfall alerts |
| Mobile native build | Web-responsive only with phone-frame bezel | React Native or Capacitor wrap |

### AI surfaces

| Item | Current state | V2 work |
|---|---|---|
| Multi-avatar functional rollout | Visual completeness per C.18 — Compass/Sailboat/Hammer icons + labels persist via localStorage (C.22), but chat behavior is always Strategist for Priya regardless | Real tone modulation in chat prompts, color treatments per avatar (sage/yellow Adventurer, green Builder), ritual-copy variants per archetype |
| Avatar re-evaluation | Static — set in onboarding, persists for session | Behavioral drift detection from transaction + reflection patterns; suggest avatar change |
| Time-pattern insights | Not surfaced | Spending heatmaps, post-payday spike detection, weekday-vs-weekend asymmetry (the C.10 divergence test surfaces this in test query mix) |
| Per-page co-pilot architecture | Single chat surface | Context-aware AI per surface (Reflect-specific assistant, Goals-specific assistant) |
| On-device LLM inference | All Vertex calls server-side via Edge Functions | Sensitive contexts (e.g., user querying their own income) processed on-device |

### External integrations

| Item | Current state | V2 work |
|---|---|---|
| Real expert-handoff booking | SEBI deflection routes to template response | Actual CA / SEBI-registered advisor booking surface with calendar integration |

### Demo affordances (V2 polish, optional)

| Item | Current state | V2 work |
|---|---|---|
| Time-travel demo affordance | DEMO_TODAY pinned to 2026-05-01 (the canonical demo state) | "Advance demo date by one month" button to show different ritual states across May-Oct |
| Gamification of streaks/achievements | None | If added, Reviewer Console gains a reset-progress action; not currently in scope |

### Banked-for-post-delivery (build-adjacent, not really V2)

| Item | Decision ID | Status |
|---|---|---|
| Divergence test artifact | Phase 3 Build C.23 | Banked. ~2-3 hr work. `scripts/run-divergence-tests.mjs` + `docs/divergence-tests.md`. Reviewer Console "View divergence tests" row stays DEMO_MODE_MESSAGE until built. |
| Case study writeup | Phase 3 Build C.24 | Banked. ~6-10 hr work. Portfolio document. Reviewer Console "Read case study" row stays DEMO_MODE_MESSAGE until built. |

---

## Tier 2 — Known limitations of shipped surfaces

These are documented disclosures from Phase D's PM_DECISIONS Section E. Things that work, but with constraints worth naming honestly. The discipline tier — few PM portfolios track this category at all.

### E.2 — Verdict query "right now" trips timing filter
Acceptable per scope_filter charter (C.13). "Right now" matches the timing-deflection regex and routes to SEBI handoff for some borderline cases. Not a bug — the filter is intentionally cautious.
**V2 hardening:** smarter timing intent classifier that distinguishes "should I act right now" (in scope) from "is now a good time to invest" (out of scope).

### E.3 — Cold-call latency on verdicts: 6-15s
Vertex JWT mint pattern is slow on cold isolates. Same observation on onboarding synthesis (5-12s cold per C.19).
**V2 hardening:** typing indicator copy improvements + preload-on-input-focus to warm the isolate before submission.

### E.4 — Rapid-labeling residual race on Reflect patterns
Stream 0.5j-fix solved the diagnosed race; 2-3 labels in quick succession may still fire 2-3 Vertex calls instead of 1. Eventually consistent (last-write-wins). Manual ↻ refresh affordance per B.17-ext is the user-facing escape hatch.
**V2 hardening:** debounce on labels OR skip-if-in-flight discipline in the synthesis trigger.

### E.5 — forceResynthesizePatterns no spinner beyond "Running…" text
Reviewer Console action. Acceptable for reviewer-tools surface but unpolished.
**V2 hardening:** loading spinner + completion confirmation snackbar.

### E.6 — AllocationRow "empty" branch unreachable (pre-existing Doc 1.2 dead code)
KindIcon default 'empty' arm renders a grey square that never displays because rows always have either a destination or the placeholder dropdown.
**V2 hardening:** remove dead branch, OR keep as defensive default with documenting comment.

### E.7 — Ritual screen page title 30px is extrapolation, not direct JSX spec
JSX preview (`docs/savio_preview.jsx`) is home + chat only. Ritual screen titles at 30px applied uniformly per Stream 0 type scale.
**V2 hardening:** explicit ritual-screen type scale in design system, OR accept 30px as the locked spec going forward.

### E.10 — 22 residual lint warnings after Phase D sweep
Down from 73 baseline (Phase D Section 4 sweep). Categorized:
- **13 no-explicit-any** — refactor scope, not blocker
- **7 react-hooks plugin warnings** — overzealous on legitimate localStorage-on-mount patterns (ProfilePill, ProfilePage post-0.5n)
- **2 react-refresh/only-export-components** — non-component exports from component files

**V2 hardening:** refactor `any` types, suppress plugin warnings with documented inline comments OR upgrade plugin to a version that recognizes the patterns.

### E.12 — Cumulative test-script seed pollution pattern (FULLY addressed in Phase D-followup)
April reflection leftovers surfaced 3 times across Phase B/C verification. Phase D Section 3.2 added try/finally hygiene to `scripts/phase05j-fix-race.mjs`. Phase D-followup D.16 went further: shared `snapshotChat()` helper at `scripts/lib/chat-snapshot.mjs` preserves row IDs (UUID) across `clear_chat_history` round-trips, wired into `phasec3-verdict-check.mjs` and `phase05m-prose-labels.mjs` with full try/finally coverage. End-to-end verified: planted 4-row chat → ran phase05m-prose-labels (which calls clear_chat_history 7× during test) → 4 rows restored intact post-run.
**V2 hardening (partial):** `phase3.5-verify.mjs` top-level early-exit pattern (`if (signErr) process.exit(1)`) can't easily be wrapped without refactor. Restore added at end but partial coverage. Acceptable scope cut — the script is an RPC-behavior test, rarely run during live demos.

### E.13 — Mid-cooldown reviewer overlap
The login-triggered demo auto-reset (D.15) uses a 60-minute cooldown via `maybe_reset_demo()`. Reviewer B logging in 30 minutes after Reviewer A still sees Reviewer A's chat history, saved decisions, and labeled reflections. Next post-cooldown login is fresh.
**Why it's acceptable:** Portfolio review traffic is low. Most reviewer sessions are solo, well-spaced.
**V2 hardening:** shorter cooldown (15 min?) OR per-session ephemeral state pattern (anonymous auth + per-guest seed copy).

### E.14 — Verification scripts still call real Vertex
D.16 snapshot/restore makes scripts state-safe (DB rows preserved across calls to `clear_chat_history`), but they still invoke `chat-respond` live against Vertex.
**Implication:** Verification scripts burn Vertex quota when run. Don't execute during a reviewer demo for that reason — quota interference + latency.
**V2 hardening:** mock-Vertex layer for verification scripts, OR scripts annotated "do-not-run-during-demo" in their headers.

### Items previously in this tier, FIXED in Phase D or Phase D-followup or Stream 0.5o

For traceability — items that started as Section E disclosures and got fixed during the audit / pre-delivery phases. Useful for case study to show the audit actually moved items off the disclosure list:

- **E.1 — Hallucination guard scope limited to verdict_line** → Fixed in Stream 0.5o (became D.18). New `hallucinationGuardStructured()` wrapper runs the single-string guard against `verdict_line`, `body`, `best_next_step`, and each element of `tradeoffs[]`. Corrections tagged with field name. Fallback discipline unchanged: any unverified rupee/percentage triggers prose-error fallback. 10/10 verdict dispatch tests still pass — no false positives on grounded numbers.
- **E.8 — Reviewer Console didn't clear `savio_demo_avatar` on reset** → Fixed in Phase D (became D.6). `clearOnboardingLocalState()` helper called in all three reset handlers.
- **E.9 — Onboarding doesn't auth-gate `/`** → Fixed in Stream 0.5o (became D.17). OnboardingPage now checks for active Supabase session on mount; redirects to `/home` via replace navigation if present. Non-fatal try/catch falls through to Welcome render on any failure.
- **E.11 — WindfallAllocate sub-copy "four buckets" but renders 3** → Fixed in Phase D Section 3.5 via dynamic `{N} buckets` interpolation.
- **`reset_april_ritual` doesn't roll back goal mutations** (the seventh-mention item) → Investigated in Phase D, no fix needed. Empirically verified Migration 0011 already rolled back via `GREATEST(0, current_amount - amount)`. Banked as Phase 3 Build D.5 with lesson-learned note: *"Source-first verification applies to bugs too, not just specs. Pattern of citing 'known issues' without re-verifying against the code is the kind of error the discipline was supposed to prevent."*
- **Chat persistence to Postgres `chat_messages` empty after every build** (initially flagged as a Tier 2 disclosure post-Phase-D, May 28) → Resolved as designed behavior, not a bug. Phase D-followup D.15 made the mechanism explicit: login-triggered `maybe_reset_demo()` with 60-minute cooldown. Auto-reset reverts rollover allocations + their goal mutations, wipes chat / saved_decisions / patterns cache, resets windfalls to pending_allocation, deletes forward-month rituals, reverts April ritual, restores reflections from snapshot, stamps `last_reset_at`. The original Savio 1 plan called for `pg_cron` periodic reset; actual implementation is login-triggered with cooldown — same product intent, different mechanism. End-to-end verified: planted chat + saved_decision + extra reflection + allocated windfall → ran reset → all back to canonical. **Implication for divergence test (C.23):** the cumulative-context anchor sequence is safe — multi-turn history persists within a session (post-login, pre-cooldown-expiry), reaches the prompt, and the architecture claim holds.

### Items previously deferred to V2 Tier 1, FOUND SHIPPED in Stream 0.5o

- **Per-merchant pattern in chat grounding** → Pre-flight discovery during Stream 0.5o (banked as D.19). `prompt_builder.ts:290-297` was already querying `merchant_stats` and emitting a "Merchant reflection stats" section in Layer 3 grounding context — shipped silently during an earlier phase. Empirical confirmation: "Can I afford a ₹3,000 purchase at Myntra?" returns a verdict that cites *"your 100% regret rate at Myntra"* across body, tradeoffs, and best_next_step naturally — no separate work needed. Lesson banked alongside D.5: source-first verification applies to capability gaps too. The divergence test (C.23) gains a single-shot anchor: vanilla Gemini has no way to know Priya's merchant patterns; Savio cites them naturally.

---

## Tier 3 — Rejected permanently

Not deferred. Out of product as deliberate choice. Worth listing because the case study demonstrates judgment by naming what was rejected and why.

### Investment-instrument recommendations
**Rejected because:** SEBI line. Requires regulated advisor license to recommend specific instruments (ELSS funds, equity stocks, debt funds). Savio's `scope_filter.ts` catches these queries via four pattern families (Instruments / Providers / Timing / Tax strategy) and deflects to expert handoff.

### Tax planning and regime comparison
**Rejected because:** CA territory. Different professional license. Savio doesn't compare old vs new tax regimes, advise on 80C investments, or recommend tax-saving instruments. Scope filter catches these.

### Portfolio aggregation across asset classes
**Rejected because:** That's Vela's wedge (a separate fintech product). Savio is decision-support for income-flow management; portfolio aggregation across stocks + MFs + FDs is a different product entirely.

### Couples / household multi-user mode
**Rejected because:** Different product. Joint-finance decision-making has different UX patterns (consent flows, shared goals, separate-vs-shared transactions) that warrant their own design pass — not a feature to bolt onto Savio.

### Surveillance-based location nudging
**Rejected because:** Violates partnership voice principle. "You're near a Myntra — careful, you've regretted 4/4 purchases" crosses the line from decision-support to surveillance. The voice principle is explicit: Savio is a partner, not a watchman.

### At-decision intervention (the central reframe)
**Rejected because:** The team v1 product was structured around this — give a verdict when the user is about to buy something. Savio's rebuild rejects it on two grounds:
1. **Empirical:** consequential purchases happen in 90 seconds without the user consulting any app. The at-decision verdict model is misaligned with how impulse purchases actually work.
2. **Architectural:** apps cannot detect the at-decision signal automatically (they aren't omnipresent). Users would have to initiate, and they won't initiate at the moments where it would matter most.

**The reframe (what Savio targets instead):** three book-ending moments where the user is already reflective — monthly anchor ritual, windfall ritual, post-purchase reflection. Plus ambient awareness through the chat surface and home dashboard.

This is the strongest single PM judgment in the build. The case study should foreground it.

---

## Summary by tier

| Tier | Count | Case-study muscle |
|---|---|---|
| Tier 1 — Deferred to V2 | ~20 items (1 found shipped in 0.5o) | Prioritization — scope choices under time constraints |
| Tier 2 — Known limitations | 13 items (incl. 6 fixed in Phase D / D-followup / 0.5o) | Discipline — honest about constraints of shipped state |
| Tier 3 — Rejected permanently | 6 items | Strategic judgment — what NOT to build |

---

## For the case study writeup (C.24)

When writing the V2 / out-of-scope section of the case study, recommended structure:

> **What's not shipped (and why)**
>
> Savio v1 is a portfolio MVP, not a production app. Three categories of "not shipped" matter, and each demonstrates a different muscle:
>
> **Deferred to v2.** [Pick the highest-impact 6-8 from Tier 1 — likely: real statement parsing, Account Aggregator integration, multi-user auth, multi-avatar functional rollout, time-pattern insights, scheduled reflection prompts, push notifications, expert-handoff booking.]
>
> **Known limitations of what shipped.** [Pick the sharpest 4-5 from Tier 2 — likely: cold-call latency, rapid-labeling race, residual lint debt, mid-cooldown reviewer overlap.]
>
> **Rejected on product grounds.** [List all 6 from Tier 3 — they're each load-bearing for the judgment story. The SEBI line and at-decision reframe are essential.]
>
> Each category demonstrates a different muscle: deferred = prioritization, limitations = discipline, rejected = judgment.

---

## Source references

- Savio 1 chat history (May 2026, pre-Phase-3 architecture work)
- Savio 2 chat history (May 27, Phase 3 build through Phase D audit, May 28 Phase D-followup + Stream 0.5o)
- `PM_DECISIONS.md` Foundation Decisions + Phase 3 Build Decisions sections
- `docs/savio_prd.md` §13 (original out-of-scope inventory from Savio 1)
- Phase D Final Report (2026-05-28) — Section E disclosures finalized
- Stream 0.5n+ Final Report (2026-05-28) — Profile identity hero life-stage extension
- Phase D-followup Final Report (2026-05-28) — D.15 auto-reset (Migration 0018) + D.16 script snapshot/restore
- Stream 0.5o Final Report (2026-05-28) — D.17 auth-gate / route + D.18 hallucination guard extension + D.19 per-merchant pre-flight discovery

---

*End of V2 inventory.*
