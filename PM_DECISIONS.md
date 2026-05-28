# Savio — Product Management Decisions

This is the running record of product decisions made during Savio's build. Engineering work descends from these decisions, not the other way around. When a new doc gets drafted, it references decisions in this file.

This file is curated, not exhaustive. Engineering details live in CLAUDE.md and the build docs. Product opinions live here.

Last updated: 2026-05-28 — Phase 3 complete (tag `phase-3-complete`). All Phase A/B/C/D work shipped: B1 Profile expansion · B2 v2 Reflect hybrid · B3 Goals · C1 Monthly Ritual 7-screen · C2 WindfallFlow · C3 Verdict Cards · C4 Onboarding · 0.5j-n polish streams · D audit + lint sweep. Banked for post-delivery: divergence test artifact (Phase 3 Build C.23) and case study writeup (Phase 3 Build C.24).

---

## Core thesis

**Savio translates raw financial data into felt consequence at book-ending moments.**

The book-ending moments are: monthly anchor (close-out + plan-ahead ritual), windfall arrival (bonus, refund, gift), post-purchase reflection (label how it felt). NOT at the moment of decision.

This is the whole product opinion. Everything below descends from it.

The opposing model — budgeting apps that nag you at the point of purchase — fails because the user has already committed psychologically by the time the app pings. Savio's bet is that reflection at the right book-ending moment compounds behavioral feedback in a way real-time alerts cannot.

---

## Target user

**In-between-income Indians, Tier 1/2 cities, ₹40K–1.2L/month net.**

Not for the rich (they have wealth managers). Not for the poor (they have different problems). For the segment where every rupee has a story but tools treat them like spreadsheet rows.

Canonical demo persona: Priya Sharma, 28, Bangalore, ₹68.5K net, Strategist avatar, supporting dependents. Profile is intentionally detailed because the case study lives or dies on Priya feeling like a real person with real tensions, not a synthetic test case.

---

## Brand voice — Strategist avatar

Savio's voice is math-forward, decisive, not preachy. The Strategist archetype embodies this.

What this means in practice:

- No confetti animations on success
- No "Great job!" celebration copy
- Understated checkmarks, not green-tick fanfare
- Numbers stated, not editorialized ("₹3,579 leftover" not "Amazing! You saved ₹3,579!")
- Tradeoffs surfaced, not avoided
- "Worth it" as a label carries equal weight to "Regret" — affirmation isn't a participation trophy

Adventurer (warmth-forward) and Builder (structure-forward) avatars exist in schema but not in onboarding. Multi-avatar onboarding deferred to V2.

**Why this matters for the case study:** the tonal restraint is the product opinion. A reviewer should be able to look at the ritual-complete screen, see the small green checkmark, and read it as deliberate. If they think "this should be more celebratory," they're missing the thesis.

---

## Linear consistency invariant

All home and chat surfaces compute from the database at read time. No caching of derived values. Writes from any surface propagate to all reading surfaces on next render.

Concretely: HomePage's safe-to-spend is a live query, not a cached number. When the rollover RPC writes to `rollover_allocations` and updates a goal balance, HomePage's next render reads new state and reflects it. No invalidation logic beyond standard React Query cache keys.

**Why this matters:** when Phase 5 makes chat write-capable (Issue F, UpdateProposalCard), the same invariant holds — chat-originated writes propagate to home and back to chat grounding. This isn't an engineering choice, it's a product commitment about how Savio's mental model of the user stays coherent across surfaces.

In hiring conversations, this is the principle you point to when asked "how do you ensure data consistency?"

---

## Three-mode build classification

Every feature is one of:

- **[REAL]** — fully wired end-to-end. Database writes propagate, all consumers update.
- **[PRESENTATIONAL]** — clickable, simplified backend, may not fully persist or persist in simplified shape.
- **[DOCUMENTED-FAKE]** — UI surface with honest "demo mode — V2" note. No real backend.

Current state:
- `[REAL]`: chat (read-only), home dashboard, safe-to-spend calculation, hallucination guard, scope filter, monthly ritual + rollover, reflection labeling within ritual, Reviewer Console (Phase 3.5 incoming)
- `[PRESENTATIONAL]`: windfall ritual, profile (until Phase 4)
- `[DOCUMENTED-FAKE]`: statement upload, SMS permission, bank-connect, manual categorization queue

**Why this matters:** honesty is the product opinion. Telling a recruiter "this is presentational, real version reuses the split-allocation primitives in Phase 4" is stronger than pretending everything works. Reviewers respect the framing.

---

## Rollover model (Phase 3 centerpiece)

Decisions, in priority order:

1. **User picks destination at month-end ritual.** Not auto-routed. Respects agency. The product doesn't decide where leftover money goes — Priya does.

2. **Rollover happens when user completes ritual.** Not auto on the 1st. The book-ending principle: closing the month is an intentional act, not a calendar event.

3. **Leftover includes commitment buffers, not just discretionary.** This is the load-bearing case-study decision. "Savio noticed you under-spend groceries by ₹2,400 every month, that compounds into your phone fund" is the demo moment. Commitment-level budgeted-vs-actual is required for this story.

4. **Negative-leftover branch: skip allocation, no deficit-payback.** If April closed at a deficit, show "April closed at a deficit, May starts fresh." No "pay it back from your goals" mechanic. Shame is not a product feature.

5. **Split rollover (Doc 1.2 incoming).** User can allocate across multiple destinations (some to Goa trip, some to Emergency fund, some carry-forward). Matches how people actually think about windfall-shaped money — not one bucket, multiple priorities.

6. **Pay-cycle user-defined.** Profile field supports custom cycles. Phase 3 assumes calendar month (Priya's case), schema supports V2 expansion.

7. **Audit trail via `rollover_allocations` table.** Append-only. Enables "saved ₹47K over 3 months" feature in Phase 6. The trail is a product feature, not just engineering hygiene.

---

## Reflection labeling

Decisions, in priority order:

1. **Three labels: Regret / Neutral / Worth-it.** Emotional vocabulary, not budget categories. Not "necessary/unnecessary" or "planned/impulse" — those are taxonomies. Reflections are feelings.

2. **Labels surface during ritual close-out, not at moment of purchase.** Book-ending principle. Real-time labeling would create the same nag-loop budgeting apps fail with.

3. **Worth-it carries equal product weight to Regret.** Affirmation is a feature. The "Myntra 100% regret rate" pattern Doc 2 will surface is meaningful precisely because Amazon shows mixed labels — contrast creates insight.

4. **Aggregation surfaces in Doc 2.** Regret-rate per merchant becomes a card on home or a grounding context for chat. Pattern recognition, not nagging.

5. **Labels are personal, not normative.** Savio never says "you should regret this." It says "you said you regret this." Self-attribution is the only honest framing.

---

## Chat surface decisions

1. **Single Edge Function (`chat-respond`).** Not chained classify-intent + generate-response. Latency target < 3s median is more important than architectural modularity.

2. **Hallucination guard with derived-arithmetic acceptance.** ±2% tolerance for arithmetic the model could plausibly compute. Guards against fabrication, allows reasoning.

3. **Scope filter — 4 families.** Savio refuses to be a stock-picking app, a tax advisor, an instrument recommender, or a timing oracle. The refusal is a product opinion: "I help you understand your money, not manage your portfolio."

4. **Verdict + Save Decision pattern.** Chat outputs that contain verdicts become referenceable artifacts (saved decisions). Chat isn't ephemera — significant moments persist.

5. **Read-only today, write-capable in Phase 5.** The separation of consultation from mutation is deliberate. Conversational mutation (Issue F, UpdateProposalCard) requires explicit Confirm/Decline UX — chat suggesting a change is different from chat enacting it.

6. **Structured responses in Phase 5a (Decision 3 deferred).** Chat will gain verdict + tradeoffs + best-next-step as a structured payload. Today chat is prose-on-canvas; Phase 5 introduces card pattern with asymmetric corners.

7. **Rainbow gradient avatar for Savio, Compass for Priya.** Visual separation of agent vs user. The user is always Priya's avatar, the AI is always rainbow — even when chat becomes write-capable in Phase 5.

---

## Demo affordances as product features

The meta-product opinion: demo affordances are not hidden dev tooling, they're visible portfolio features.

1. **DEMO_TODAY auto-computes to 1st of current month.** Portfolio piece doesn't bit-rot. If a recruiter reviews Savio in November, they see November-1 reality, not stale April reality.

2. **Deterministic seed (Doc 1.1 incoming, `setseed(0.42)`).** Canonical demo screenshots stay valid forever. Every reseed produces byte-identical numbers.

3. **Reviewer Console (Phase 3.5) visible by design.** Three reset actions (ritual, chat, reflections) live on the Profile page with explicit framing: "These tools let you re-experience Savio's flows. Dev-only in spirit; visible because that's the point of a portfolio piece."

4. **Honest "[DOCUMENTED-FAKE]" labels on incomplete surfaces.** Statement upload, SMS permission, bank-connect all show "demo mode — V2" notes rather than pretending to work.

**Why this matters:** the meta-product feature is "I built honest demo affordances into the product." That's the talking point, not "the dev tools are hidden so users can't see them." Hiding implies these aren't intentional.

---

## Avatar system

- **Strategist (Priya):** math-forward, decisive. The only functionally seeded avatar.
- **Adventurer:** warmth-forward, exploration-themed. Schema exists, visual identity exists in onboarding design.
- **Builder:** structure-forward, system-themed. Schema exists, visual identity exists in onboarding design.

**Status note (updated per Option D commitment):** Earlier this section read "multi-avatar onboarding deferred to V2." That position has been refined:

- **Visual avatar selection ships in Phase 3** as part of the onboarding walkthrough (Step 5). Reviewers experience all three avatars as selectable options with full visual treatment, blurbs, and taglines.
- **Behavioral avatar differentiation deferred to V2.** Avatar-specific tone modulation in chat grounding, avatar-specific color treatments across the app, avatar-specific ritual copy — all V2 work. Priya is always Strategist regardless of what's selected during the walkthrough; the end-of-onboarding interstitial frames this honestly.

For the portfolio piece, this is the right level of completion: design quality demonstrably real, functional differentiation honestly deferred.

Visual marks:
- **Compass:** Priya's avatar mark (user, Strategist)
- **Rainbow gradient circle:** Savio's avatar mark (the AI agent)

These are stable across all surfaces. Phase 5's chat card pattern will contain rainbow gradient avatar; never compass.

---

## Backlog product decisions ahead (not yet locked)

These need PM thinking when they come up. Listed here so they don't get accidentally pre-decided by engineering convenience.

### Onboarding flow

**Status: designed; walkthrough-build committed to Phase 3 (Option D); ephemeral-user functionality deferred to V2.** Reference: `docs/onboarding_design.jsx`.

A 9-step flow from cold-start to first home-page render. The design embodies several meaningful product opinions that ripple back into earlier decisions — flagged here because some change what was already locked.

**Option D — Onboarding-as-walkthrough, Priya-as-destination (locked, post-Phase-3.5)**

The reviewer experiences the full 9-screen onboarding flow, but the destination is always Priya's pre-seeded reality. Inputs are captured in React state for the flow's UX (form values render, transitions work, avatar selection highlights, life-stage choice persists across screens) but never write to the database. At the end, an interstitial screen frames the demo handoff honestly, then auto-logs-in as Priya.

This pattern threads a needle: it makes the full onboarding surface demonstrably real (every screen renders, interactions work) while preserving Priya's lived-in 6-month reality as the destination that carries case-study weight. A reviewer who chooses "Demo: log in as Priya" lands on Priya's home directly. A reviewer who chooses "Get started" walks through onboarding and STILL lands on Priya's home, having experienced the onboarding flow's design quality along the way.

**Honesty framing — dual signal (Framing 3 locked):**

1. **Subtitle on Welcome's "Get started" button:** Sets expectation up front — copy similar to "Walk through onboarding (demo continues as Priya — your inputs aren't saved)."
2. **Interstitial screen at end of onboarding, before auto-login:** A real, designed screen that says (approximately): "You've experienced Savio's onboarding flow. For the demo, you'll continue as Priya — a sample user with 6 months of lived-in activity so you can see Savio at its richest. Real user accounts with persistent data are V2 work." Single CTA: "Continue as Priya."

Both signals exist intentionally. The dual framing makes it impossible for a reviewer to be surprised at the moment of handoff, AND the interstitial itself becomes a portfolio moment — *demo affordance named explicitly, framed as a deliberate choice rather than a hidden mechanic*. This is the visible-by-design meta-product opinion applied to onboarding's edge case.

**The nine steps:**

0. Welcome — wordmark + three value-prop bullets ("grounded answers," "monthly check-ins," "reflection that builds your pattern map") + "Get started" (with subtitle) + "Demo: log in as Priya"
1. Disclaimer — privacy/data treatment, scope of what Savio does and doesn't do
2. Data source choice — statement upload / SMS permission / manual entry
3a. Statement parse review — confirm extracted income + commitments (if statement path)
3b. Manual entry — type in income + commitments (if manual path)
4. SMS permission — always shown regardless of upstream path
5. Avatar selection — Strategist / Adventurer / Builder
6. Life stage + anchor — Student / Working no dependents / Supporting dependents / Pre-retiree, plus check-in day
7. Focus goal — pick one goal to anchor this month (or "no specific focus")
8. Ready — completion screen
9. **Interstitial (new, per Framing 3)** — handoff explanation, "Continue as Priya"
10. Auto-login → home page

**Product decisions this design locks:**

1. **"Demo: log in as Priya" lives on the Welcome screen.** Visible-by-design meta-product principle applied to onboarding. Reviewers can experience the onboarding flow OR skip straight to Priya's seeded state. Both paths are first-class.

2. **All three avatars become selectable in onboarding UI (but functionally undifferentiated in Phase 3).** Strategist / Adventurer / Builder all render with blurb + tagline. The Phase 3 walkthrough commitment is *visual* completeness, not behavioral. Priya is always Strategist regardless of avatar selected during the walkthrough — that's part of what the interstitial frames honestly.

   When real ephemeral-user onboarding ships in V2, avatar selection will need to drive downstream behavior: avatar-specific tone modulation in chat grounding, avatar-specific color treatments where appropriate (sage/yellow palettes for Adventurer, green for Builder), avatar-specific ritual copy. That implementation is V2 work; the Phase 3 walkthrough doesn't ship it.

3. **Data source choice surfaces three modes honestly.** Statement upload, SMS permission, manual entry are presented as peer options. Per the existing `[DOCUMENTED-FAKE]` classification, the first two are demo-mode-V2 in the built product. The onboarding walkthrough labels them honestly within their screens — manual entry is the only functional path for the walkthrough, the other two show "demo mode — V2" within their own steps.

4. **Life stage is a constrained 4-option taxonomy, not free-text.** Student / Working no dependents / Supporting dependents / Pre-retiree. The product opinion: life stage anchors the kind of guidance Savio gives, and a controlled vocabulary is more useful than user-narrative. This matches Priya's seeded `supporting_dependents`.

5. **Anchor day is structured (1st / Mid / End) plus an "irregular" escape hatch with custom day picker.** Most users fit one of three buckets; irregular earners get the flexibility. Matches the existing `pay-cycle user-defined in profile` decision from the rollover model — but tightens it: the structured options are the primary path, irregular is the escape.

6. **Focus goal is single-select, not multi-select.** *This remains the most significant new product decision.* One goal per month gets focused attention, even when the user has multiple goals. It means home page and chat grounding need to know "Priya's focus goal for May" as a first-class concept — not just "Priya has 3 goals." This was not anticipated in the rollover model; the rollover screen currently lets you allocate to any active goal. When the focus-goal-as-first-class-concept ships (likely V2 or Phase 7), the rollover allocation UI will need to be reconciled — focus goal becomes a default highlight while other goals remain selectable.

7. **Onboarding produces Priya-shaped state schematically; in Phase 3 it produces no state at all.** The data source paths converge on the same downstream schema (profiles, commitments, transactions, goals, monthly_rituals). Priya's existing seed is essentially "what onboarding produces." For the Phase 3 walkthrough, no schema writes occur — the walkthrough is purely visual.

8. **The interstitial screen is a Phase 3 build, not a V2 build.** It's part of the onboarding walkthrough doc. Honest framing of the demo handoff is a portfolio feature.

**Open questions still unresolved:**

- For real V2 onboarding: what's the ephemeral-user cleanup mechanism? 30-minute reset implied earlier, but how is "30 minutes" measured (last-action, first-action, cookie expiry)? Out of scope for Phase 3.
- For real V2 onboarding: does the AI ever proactively suggest avatar changes based on observed behavior? Out of scope for Phase 3.
- Should the Phase 3 walkthrough preserve some user inputs across browser sessions (e.g., localStorage for the income value), or always restart fresh? Recommendation: always restart fresh — walkthrough purity over partial state.

**Why the walkthrough existing matters for the case study:**

The right framing: "Onboarding's visible product surface ships in Phase 3 as a real walkthrough. Account creation with ephemeral persistence is V2 implementation work. The walkthrough demonstrates design intent end-to-end without compromising the lived-in demo via Priya."

That's a credible PM call — depth on demonstrable UX surface, V2 deferral on the infrastructure that doesn't add case-study weight. A reviewer who walks through onboarding gets the full design experience; the case-study story stays anchored in Priya's six-month reality.

### Gamification of achievement

Wishlist for post-solid-piece iteration. The Strategist tone tension is real here — gamification typically conflicts with "no confetti" tonal restraint.

Open questions:
- What achievements are on-brand? "Completed 3 rituals" feels okay; "Saver streak 🔥" does not.
- Visual treatment: badges in a profile section, or surfaces inline in moments?
- Does this become a separate Reflect-tab feature, or does it live in Profile?
- Hard question: does gamification undermine the Strategist thesis by introducing extrinsic motivation?

### Conversational mutation (Phase 5b, Issue F)

Locked architecturally but not yet built. Decisions made:
- Intent classifier distinguishes question vs update vs verdict
- `UpdateProposalCard` with explicit Confirm/Decline (no implicit writes)
- Mutation logic per update type (buffer, income, goal target, contribution, commitment)
- Optimistic UI with rollback on failure

Open questions:
- What's the temp-store mechanism between propose and confirm — chat_messages row with `kind = 'update_proposal'`, or a separate proposals table?
- Can the user undo a confirmed mutation? If yes, for how long?
- Does the AI ever proactively propose updates (e.g., "your rent has gone up — should I update it?"), or only respond to user-initiated mentions?

### Structured chat responses (Phase 5a)

Locked architecturally. New Edge Function payload shape: `{ verdict, prose, tradeoffs[], next_step }`. New UI components: TradeoffCallout, BestNextStep. MessageBubble shifts to card pattern with asymmetric corners.

Open questions:
- Does every chat response become structured, or only verdict-bearing ones?
- How does the AI decide what's a "best next step"? Heuristics or LLM-driven?
- Are tradeoffs always 2-3 items, or variable count?

---

## Phase 3 Foundation Decisions (banked 2026-05-27)

These decisions were banked across the Stream 0 / 0.5 / 0.5b / Doc 1.2 resumption sequence — the visual foundation passes that landed before per-surface Phase B/C builds began. Each entry follows a Decision / Rationale / Implication for future / Date format so future builders see the reasoning, not just the conclusion.

### Section A — Schema and data model

#### A.1 Migration 0012 dropped

**Decision:** No `is_fixed` boolean column on `commitments` table.

**Rationale:** The `commitments.kind` text column (values: `'fixed'` | `'variable'`) from Doc 1.1 already serves as the discriminator. Adding a parallel boolean would be duplicate data. The `upcoming-bills.ts` query uses `kind === 'fixed'` directly.

**Implication for future:** When someone proposes adding `is_fixed`, point them to this decision. The text column is the canonical discriminator.

**Date:** 2026-05-27 (Phase 3 completion session)

---

### Section B — Visual foundation principles

#### B.1 Phone bezel chrome retained

**Decision:** PhoneShell renders bezel + notch + fake status bar chrome around the app content. Overturns master plan principle 2.1 #8 ("No phone-frame chrome in product — responsive mobile web").

**Rationale:**
- Portfolio presentation reads stronger as "designed mobile app" than "responsive web that happens to be narrow"
- Behance Credifyx reference uses bezel chrome — industry-standard convention for mobile product mockups
- The case-study story is "mobile app I built" — bezel reinforces that framing visually
- Bezel was removed by Stream 0.5-G per the original master plan, then restored by Stream 0.5b after the framing decision was reconsidered

**Implication for future:** Bezel chrome is intentional. Removing it again requires explicit re-discussion of portfolio framing.

**Date:** 2026-05-27

#### B.2 MonthlyRitualBanner uses vertical layout (deviation from JSX preview)

**Decision:** `src/components/home/MonthlyRitualBanner.tsx` uses vertical composition (icon + title row, body row, full-width Start button row) instead of JSX preview's horizontal flex (icon + title-body-stack + Start button on one row, per `docs/savio_preview.jsx` lines 222-249).

**Rationale:**
- JSX preview's horizontal composition breaks at narrow bezel-constrained widths (~375px internal): title text + Start button exceeds available row width, causing orphan-word wrap ("ready" alone on a line)
- Vertical layout matches the WindfallCard pattern from the same preview file (lines 174-218), so it has design-system precedent
- Card grows ~30-40px taller as the trade-off — acceptable

**Implication for future:** Don't "fix" this back to horizontal as drift correction. If someone sees JSX preview using horizontal and proposes alignment, point them here.

**Date:** 2026-05-27

#### B.3 Typography weight defaults to 400 (Regular)

**Decision:** Body content, card titles, page titles, transaction names, and most rendered text uses `fontWeight: 400`. Weight 500 is reserved for specific deliberate emphasis: hero numbers (₹X), pill text, button labels, section headers ("For you today" / "Recent transactions"), inline emphasis markers, and explicit JSX preview weight-500 elements (windfall amount line, ritual banner title, commitments count number).

**Rationale:**
- JSX preview uses weight 400 for nearly everything; Stream 0 over-corrected by sweeping many elements to 500
- Visual emphasis comes from size + color, not weight, in this design system
- 36px page titles read as deliberate at weight 400 — adding 500 on top makes them feel loud/bold

**Implication for future:** When in doubt about weight, default to 400. Weight 500 requires JSX preview justification.

**Date:** 2026-05-27

#### B.4 Typography sizes are JSX-spec-specific, not uniform tokens

**Decision:** Body content sizes vary per element: 14, 14.5, 15, 12.5, 11.5 — matched per element to JSX preview line references. The design token scale (16/14/12) covers common cases; inline `fontSize` values like 14.5 / 12.5 are deliberate fine-tuning, not drift.

**Rationale:**
- Stream 0 attempted a blanket "body → 16px" sweep that pushed many elements above their JSX-preview-specified sizes
- JSX preview uses fine-grained sizes (12.5 for windfall body, 14.5 for ritual banner title, etc.) that don't fit the standard token scale
- Tokens describe the rhythm; per-element values are the rhythm's actual notes

**Implication for future:** Don't sweep all `fontSize: 14.5` instances to `fontSize: 14` for "consistency." Each value cites a JSX preview line.

**Date:** 2026-05-27

---

### Section C — Operating discipline principles

#### C.1 "JSX preview is quieter than instinct"

**Principle:** When uncertain about a typography or layout choice during build, the JSX preview is typically quieter (lower weight, smaller size, less prominent) than what instinct says. Default to lower weight and smaller size unless JSX preview explicitly specifies otherwise.

**Origin:** Surfaced in Stream 0.5 after Stream 0's per-element corrections revealed the over-correction pattern. Page titles, body content, and card titles were swept to 500 weight + 16px when JSX preview specifies 400 weight + 12.5-15px.

**Implication for future:** Apply when interpreting any ambiguous spec. If the spec says "make it prominent," the JSX preview probably interprets "prominent" more restrainedly than instinct.

**Date:** 2026-05-27

#### C.2 Source-first verification

**Principle:** Before writing code for any surface or component, read the relevant JSX preview lines first. Cite line numbers in the build artifact (commit message, report, or code comment). Don't build from memory of what the preview looks like.

**Origin:** Established in Stream 0 spec; reinforced through Stream 0.5 / 0.5b execution where Claude Code repeatedly cited JSX line numbers per element correction.

**Implication for future:** Every per-surface spec includes JSX preview line references. Every build report cites which JSX lines were verified against.

**Date:** 2026-05-27

#### C.3 "Things noticed but not fixed" discipline

**Principle:** During build, when Claude Code discovers drift or issues outside the current task scope, document them in a "Things noticed but not fixed" report section. Do NOT auto-fix outside scope. Surface for PM review and prioritization.

**Origin:** Applied consistently across Stream 0 / 0.5 / 0.5b / Doc 1.2 reports. Examples: Stream 0 noticed Card primitive shadow (fixed in 0.5), PhoneShell chrome (removed in 0.5, restored in 0.5b after PM reconsideration), reflection count drift in doc1.1-verify (left for reseed).

**Implication for future:** Build discipline includes both delivery (what was done) and transparency (what was seen but deliberately not done). This is how the build stays bounded without losing context on drift.

**Date:** 2026-05-27

#### C.4 No scope expansion mid-build

**Principle:** Once a spec is sent to Claude Code, the scope is locked. Any drift discovered during execution gets surfaced ("Things noticed") but not auto-fixed. PM decides whether discovered items become follow-up specs or remain known-issues.

**Origin:** Stream 0 / 0.5 / 0.5b execution discipline. Prevents specs from accreting unbounded fixes and breaking time estimates.

**Implication for future:** PM authority is durable across the session. Build discipline is durable across phases. Drift discovery is not authorization to fix.

**Date:** 2026-05-27

---

### Section D — Design system structure

#### D.1 Card chrome is hairline border only

**Decision:** All Card primitive variants use `border: 0.5px solid rgba(0,0,0,0.07)` and `border-radius: 22` (default) or `24` (hero). No `box-shadow`, no elevation, no glow effects.

**Rationale:** JSX preview Card component (lines 57-72) specifies hairline border only. Shadows add visual weight that contradicts the design system's restraint principle.

**Implication for future:** When someone proposes adding shadow for "depth," point to this decision. Depth comes from spacing and hierarchy, not shadows.

**Date:** 2026-05-27 (codified via Stream 0.5-F)

#### D.2 Pure pill buttons, hairline borders, no shadows

**Decision:** All buttons use `border-radius: 999` (pure pill), hairline border for outline-style buttons, primary CTAs use `backgroundColor: T.p` (dark) with white text. Paired CTAs (like WindfallCard's Allocate now / Skip for now) use `flex: 1` for equal width.

**Rationale:** JSX preview button component (line 41) and CTA usage patterns. Consistent visual rhythm across all button instances.

**Implication for future:** Rounded-rectangle buttons (border-radius 12) are reserved for non-button surfaces (like Looking back label rows). True buttons are pills.

**Date:** 2026-05-27

#### D.3 Avatar plate iconography

**Decision:** Profile/identity avatar plate uses a 40×40 white rounded-square plate (border-radius 14) with the Strategist Compass icon in T.avStop (#0C447C navy). For surfaces showing the user identity, the navy color is reserved for avatar context only — not used elsewhere in the design system.

**Rationale:** JSX preview ProfilePill (lines 127-152). Establishes the avatar identity as the only place navy color appears in the standard UI flow. Navy becomes part of the avatar's character, not a general accent color.

**Implication for future:** Don't extend navy into other UI elements. Avatar identity is the sole context.

**Date:** 2026-05-27

---

### Section E — Process improvements adopted

#### E.1 Pre-spec verification reports

**Process change:** Before Claude Code begins build on a spec, it conducts a pre-flight grep audit to confirm assumptions (existing function signatures, schema column existence, etc.) and surfaces design decisions for PM confirmation. PM confirms decisions, then build proceeds.

**Origin:** Doc 1.2 split rollover pre-flight (Stream C grep + 6 design decisions confirmed). Avoided expensive rework when assumptions turned out to be slightly different from spec.

**Implication for future:** Any non-trivial backend spec (schema changes, RPC signature changes) gets pre-flight verification before build. ~30 min of audit prevents hours of rework.

**Date:** 2026-05-27

#### E.2 Per-element typography audits, not blanket sweeps

**Process change:** Typography corrections (weight, size) work per-element with JSX preview line citations, not via blanket "sweep all body to 16" rules. Each element decision is justified by a preview reference.

**Origin:** Stream 0's blanket sweep caused systemic over-correction; Stream 0.5's per-element audit corrected it cleanly.

**Implication for future:** When typography drift is discovered, the fix is per-element audit, not a sweep in the other direction (which just creates new drift).

**Date:** 2026-05-27

---

## Phase 3 Build Decisions (banked 2026-05-28)

These decisions were banked across Phase A/B/C/D execution — per-surface builds (Profile expansion / Reflect hybrid / Goals / Monthly Ritual 7-screen / WindfallFlow / Chat verdict cards / Onboarding walkthrough) plus the alignment / prose-path / Reflect-AI streams in between. Numbering is scoped to this section to avoid collision with the foundation-decision entries above (which use the same letters for unrelated topics — JSX-preview discipline vs feature decisions). When a Phase 3 build decision is cited elsewhere, qualify as "Phase 3 Build B.5" / "Phase 3 Build C.7" etc.

Format here is intentionally lighter than the foundation entries above — one or two sentences per decision instead of the full Decision/Rationale/Implication/Date stanza. The reasoning is captured in line in the prose where it matters.

---

### Section B — Per-surface build (Profile / Reflect / Goals / Ritual)

#### B.5 Reflect surface is hybrid (labeling + patterns)
Deliberate extension beyond JSX preview lines 584-684, which specify only a labeling surface. Phase B2 v2 builds the labeling surface per JSX AND adds a patterns section below. Hybrid serves both fidelity and case-study value.

#### B.6 Goals header departure from JSX
JSX preview at lines 689-776 renders Goals page directly without a header. Build adds a 36/400 "Goals" header for consistency with Profile/Reflect surfaces (B1 established this header pattern). Deviation accepted.

#### B.7 Goal status + milestones hardcoded per goal label
Status pills (on-track / behind / at-risk) and milestone callouts are derived from goal label string in Phase B3, not from a status column. Goal labels are stable per Priya's seed; production V2 would derive from contribution history.

#### B.7-ext Seed target dates supersede JSX preview hardcodes
Emergency Dec 2027 (seed) vs Mar 2027 (JSX preview) — build renders seed values. JSX dates were design-time approximations; seed values derived from Priya's actual contribution capability against goal targets. Case-study framing: "values derived from realistic contribution math, not design mockup."

#### B.8 Reflect uses ₹1,000 amount floor on unlabeled query
Stream 0.5f added `.gt('amount', 1000)` to the unlabeled-transactions query. Filters micro-spend below ₹1,000 (Blinkit ₹240, UPI ₹50 noise). Silent filter, no UI signal.

#### B.9 Reflect uses ₹1,000 floor + user dismiss affordance (no commitment_id filter)
Stream 0.5g attempted `.is('commitment_id', null)` as structural filter; reverted in same session because it excluded variable-commitment-linked discretionary food (Mainland China, Toit linked to "Eating out" variable commitment). Final state: amount floor at ₹1,000 catches micro-spend; X-icon dismiss affordance with inline confirmation handles user-defined irrelevance. Case-study framing: honesty over cleverness.

#### B.10 Reflect dismiss confirmation uses inline pattern
Card content swaps to "Remove this from Reflect?" prompt with Remove/Cancel pill buttons. NOT modal sheet, NOT window.confirm(). Lighter UI, visually consistent. Reads as "the card is asking a question now" rather than introducing a separate UI layer.

#### B.11 Phase C1 chained 7-screen ritual flow (not separate close-out + setup)
Single continuous ritual combining 3-screen close-out (M-1) with 4-screen month-setup (M). Header counter renumbered "X OF 7" across all screens. Real users do the whole monthly ritual in one sitting; splitting creates friction.

#### B.12 Phase C1 no standalone Welcome screen
Welcome content absorbed into Complete (close-out) screen transition copy: "April closed. Now let's set up May →". Single transition moment, no separate welcome ceremony.

#### B.13 Phase C1 Commitments confirmation [PRESENTATIONAL]
Each commitment row shows current amount + "Same" pill. Tap fires DEMO_MODE_MESSAGE snackbar. Production Savio would detect month-over-month changes; MVP demo shows the scan pattern without supporting actual amount editing.

#### B.14 DEMO_MODE_MESSAGE supersedes V2 framing
All [PRESENTATIONAL] edit-action snackbars use DEMO_MODE_MESSAGE constant: "Demo mode — changes aren't saved for Priya." Reframes from "we cut features" to "this is intentional controlled state for portfolio viewing." Single source of truth in `src/lib/copy.ts`. Ritika's framing: "I considered every edit-disabled affordance as a chance to communicate intent, not absence."

#### B.15 Reflect patterns use AI synthesis with rule-engine fallback
Vertex AI call anchored to pre-aggregated counts (merchant, category, weekend/weekday, recent vs prior 30d). NOT raw reflection rows — constrains hallucination. Rule engine preserved at `src/lib/reflect-patterns.ts` as fallback. Cache 24h per user, invalidated on new reflection. Sparkles affordance signals AI source.

#### B.16 AI generationConfig — responseMimeType + maxTokens + timeout
`responseMimeType: 'application/json'`, `maxOutputTokens: 2048`, 30s timeout for cold Vertex isolates.

#### B.17 Manual pattern refresh as honest escape hatch (extended)
Stream 0.5j-fix solved the diagnosed race condition (refreshReflections invalidate-then-setState ordering). Stream 0.5j-fix2 added ↻ icon-button next to "Across your reflections" header as in-context manual refresh, with same silent rule-engine fallback. Auto-refresh is primary path; manual is the escape hatch. Case-study framing: "Auto-refresh is the ideal; manual refresh is the realistic escape hatch when timing edge cases surface." More honest than "we fixed the race condition perfectly."

---

### Section C — Phase C feature decisions (Windfall / Verdict / Onboarding)

#### C.5-feat WindfallFlow uses hybrid persistence
Lock-in writes JSONB allocations onto the existing `windfalls.allocations` column + flips `status='allocated'` + sets `allocated_at`. Does NOT mutate `goals.current_amount` or `monthly_rituals.safe_to_spend_locked`. Auditable allocations demonstrate persistence to case-study reviewers; stable demo state prevents drift across reviewer sessions. Production Savio would propagate writes downstream.

#### C.6-feat WindfallFlow bucket suggestions computed from real financial state
Emergency gap from Goals table, Phone gap from Goals, loan principal from seed (or dropped if absent — pre-flight discovered no loan principal in Priya seed; bucket dropped gracefully, 3 buckets render). Free spend as residual. JSX preview's hardcoded ₹20K/₹15K/₹10K/₹5K split was design-time approximation; the build computes from Priya's actual ₹6,200 windfall and real goal gaps. Demonstrates Savio's intelligence as data-driven, not template-driven.

#### C.7-feat WindfallFlow slider invariant via "clamp the dragged value"
Stream 0.5k math fix. Non-free buckets clamp to `TOTAL − sum(other-non-free)`; Free is purely derivative (drag no-op, snaps to residual). Replaces JSX preview's naive clamp-Free-to-0 which let dragged buckets overshoot total (₹52,700 sum on ₹50,000 windfall). Random-fuzz verified.

#### C.8-feat WindfallFlow includes Reset to suggested affordance
Subtle text-link below SEBI disclaimer with RotateCcw icon. Returns all sliders to initially-computed (data-driven) values. Initial state captured in ref on first mount. Departure from JSX preview which had no reset path.

#### C.9-feat Chat verdict cards return structured JSON from AI with prose fallback
Pattern 1 only for Phase C3; Pattern 2 (clarifying questions) deferred. Verdict cards include GREEN/YELLOW/RED color signal, 2-4 tradeoffs, concrete best-next-step. AI determines verdict-eligibility via prompt instruction. Frontend routes based on response shape (not query type). Save decision wires to `saved_decisions.decision_data` JSONB. Fallback chain: malformed JSON → prose bubble silently.

#### C.10-feat AI unconditional JSON contract via responseMimeType
chat-respond returns `{kind, message?, structured?}` on every call. `responseMimeType: 'application/json'` forces JSON. Defensive `"message":"…"` regex extractor handles truncated JSON; final fallback uses raw text. User never sees an error.

#### C.11-feat Buffer floor + impulse wait + daily SPS floor as derived constants
Phase C3 grounding context injects ₹1,00,000 buffer floor, 48-hour wait above ₹2,000, ₹300 daily SPS floor. Hardcoded in `buildGroundingContext` until columns exist. V2 work: expose as editable profile settings.

#### C.12-feat SaveDecisionButton RLS fix (user.id → profile.id)
Pre-existing bug discovered during Phase C3 build. Insert was using `user.id` (auth.users.id) instead of `profile.id`. Saves were failing RLS silently. Broken since Stream 0.5d/0.5e but never click-save-then-verify-DB-row tested. Phase C3 made it actively reachable. Fixed proactively in C3 scope.

#### C.13-feat scope_filter.ts timing-regex fix
Pre-existing bug discovered during Phase C3 build. Every "Should I buy" query was tripping SEBI deflection filter and getting routed away from verdict path. The `(?:…)?` made the trailing timing context optional, so "Should I buy a ₹50k laptop?" got deflected when it should have been a RED verdict. Fix: trailing context mandatory.

#### C.14-feat Chat verdict cards use alignSelf/maxWidth wrapper pattern
Stream 0.5l fix. Verdict card initially rendered without `alignSelf` wrapper, causing weak alignment that visually conflicted with user-message bubbles. Wrapper pattern: `<div style={{ alignSelf: 'flex-start', maxWidth: '92%' }}>` — matches prose bubble alignment behavior. Asymmetric `'4px 22px 22px 22px'` border-radius for the sharp top-left chat-bubble flag.

#### C.15-feat Prose chat responses mirror verdict card visual treatment except verdict-specific elements
Stream 0.5m fix. Same outer wrapper, same Card primitive with asymmetric border-radius, same speaker-badge-inside-Card placement, same timestamp-outside-Card pattern. Differences: prose drops the Verified pill, Tradeoffs callout, Best Next Step callout, and Save this decision link. The Verified pill is verdict-only — rendering it on prose diluted its meaning as a "structured math you can verify" signal.

#### C.16-feat Prose responses use "Where you stand / What it means / What you can do" labels
Stream 0.5m prompt rename. Replaced "Observation / Stake / Partnership Offer" (which read as research-paper-meets-SaaS-pitch). New labels are human and action-oriented. The labeled structure itself is preserved as a deliberate UX choice — teaches a three-step framework (current state → interpretation → action). Prompt explicitly forbids the old labels and seven other common LLM defaults (Summary, Key Insights, Recommendation, Analysis, Conclusion, etc.) to prevent drift back. Case-study framing: "Vanilla LLMs return one blob; Savio structures every prose response into three steps."

#### C.17-feat Save Decision link is verdict-only
Stream 0.5m additional cleanup. Pre-0.5m the link rendered on prose responses where `is_verdict` was true (regex fallback on user query). Verdict-eligible queries that fall back to prose lack the structured math a save would capture. Save link lives in VerdictCard exclusively now.

#### C.18-feat Onboarding walkthrough ships as Option D
Phase C4. Full 9-step flow + Welcome + Interstitial = 11 surfaces. All inputs captured in React useState only; zero DB writes. localStorage avatar persists ProfilePill icon (Compass / Sailboat / Hammer) but chat behavior stays Strategist for Priya regardless. Three [DOCUMENTED-FAKE] surfaces labeled honestly inside their screens (Statement V2 / Bank V2 / SMS V2).

#### C.18a-feat Single-route onboarding deviation from spec
Spec proposed `/onboarding/welcome`, `/onboarding/disclaimer`, etc. as separate routes. Build went with single OnboardingPage.tsx containing useState step branching, matching JSX source 1:1. Rationale: matches canonical JSX, avoids deep-link-to-mid-onboarding edge cases, keeps state simple.

#### C.19-feat Step 8 Ready synthesis AI-elevated with deterministic fallback
Phase C4. Edge Function `onboarding-synthesize` reuses shared Vertex client. 8s timeout. Hallucination guard rejects any unverified rupee value (prompt forbids rupee values entirely — synthesis is qualitative). Fallback template at `src/lib/onboarding-synthesis-fallback.ts`. ✨ icon signals AI source; hidden when fallback. Third AI surface (after chat C3 verdicts and Reflect 0.5j patterns).

#### C.20-feat Framing 3 dual-honesty signal is a designed product surface
Phase C4. Welcome button subtitle ("Walk through onboarding — demo continues as Priya, your inputs aren't saved") AND interstitial Step 9 (explicit handoff prose + "Continue as Priya" CTA). Together, no reviewer can be surprised at the moment of handoff. The interstitial is itself a portfolio moment.

#### C.21-feat thinkingConfig.thinkingBudget: 0 required for short-synthesis Gemini tasks
Discovered during Phase C4. Default thinking budget on `gemini-2.5-flash` consumed the entire `maxOutputTokens: 600` budget, returning truncated 4-6 word responses. Setting `thinkingBudget: 0` routes tokens to output. Banked for future Edge Function authors — if your Vertex task produces short responses unexpectedly, check thinking config first.

#### C.22-feat Profile identity hero reads localStorage for avatar AND life-stage with label match
Streams 0.5n + 0.5n+. Phase B1 Profile identity hero was built before the C4 localStorage avatar pattern existed, so it rendered hardcoded Compass + "The Strategist" + DB-derived life-stage regardless of onboarding choice. 0.5n inlined the localStorage read pattern from ProfilePill (AVATAR_ICONS / AVATAR_LABELS maps + `isAvatarKey` guard + fallback `localStorage → DB → 'strategist'`). 0.5n+ extended to the second pill: `LIFE_STAGE_LABELS` map with strings matching onboarding JSX option labels verbatim; `formatLifeStage` title-case helper retired. Presentation-layer only — both `profile.avatar` and `profile.life_stage` in DB stay canonical for chat grounding. The C.18/C.20 "Your choice carries through visually" promise now spans both pills end-to-end.

#### C.23-feat Divergence test artifact (BANKED, not built yet)
Markdown artifact at `docs/divergence-tests.md` + generator script at `scripts/run-divergence-tests.mjs`. Calls both Savio's chat Edge Function and a vanilla Vertex/Gemini endpoint, captures outputs, formats side-by-side. Query mix: 2-3 verdict-eligible + 2-3 prose + one cumulative-context anchor sequence (Turn 1: "Can I afford a ₹5,000 watch?" GREEN → Turn 2: "what about 8k watch?" remembers context → Turn 3: "on top of this 8k watch I also want a ₹1L Apple Watch" → cumulative load). PLUS prose-structure comparison (Savio's three labels vs vanilla LLM blob). Reviewer Console "View divergence tests" row wires to this once it exists. **Banked decision, not built in Phase 3.**

#### C.24-feat Case study writeup is post-delivery deliverable (BANKED, not built yet)
Portfolio document covering Phase 3 architecture decisions, build narrative, screenshots. Separate writing/curation work. Reviewer Console "Read case study" row stays as DEMO_MODE_MESSAGE until artifact exists. **Banked decision, not built in Phase 3.**

---

### Section D — Phase D housekeeping decisions

#### D.4 Save button pill outline departure from JSX
Stream 0.5e small polish. Faint pill outline (5px×12px, 0.5px border at 8% opacity, pure pill border-radius). T.t → T.s color shift. Departure from JSX preview which had no outline. Case-study framing: small but visible polish — the button now reads as a deliberate small action button, not unstyled text.

#### D.5 reset_april_ritual goal rollback — investigated, no bug
Phase D pre-flight. Spec proposed a Migration 0017 to fix `reset_april_ritual` not rolling back `goals.current_amount`. Empirical verification showed Migration 0011 (Doc 1.2 split rollover) ALREADY iterates `rollover_allocations`, decrements destination goals via `GREATEST(0, current_amount - amount)`, deletes allocations, and resets the ritual row — all in one transaction. End-to-end test: Phone fund ₹8,000 → run gate3 → ₹10,953.85 → call `reset_april_ritual` → Phone fund back to ₹8,000 exactly. **No fix needed.** Documenting here because the "bug" was cited 7 times across Phase C reports — a false-alarm pattern. Manual restores during build were unnecessary; running the RPC would have sufficed. Lesson for future build reports: verify symptom before banking as a known issue.

#### D.6 Reviewer Console resets clear localStorage avatar + life-stage
Phase D fix. Each of the three reset handlers (reset April ritual / clear chat history / restore reflection labels) now also calls `localStorage.removeItem('savio_demo_avatar')` and `localStorage.removeItem('savio_demo_life_stage')`. Ensures ProfilePill and Profile identity hero return to defaults (Compass + Supporting Dependents) after any reset. Addresses the "noticed but not fixed" item from Phase C4 verification.

#### D.7 Legacy completed_at backfill on Jan/Feb/Mar 2026 rituals
Phase D fix. Seed-state completed rituals had `completed_at = NULL` because the seed never populated the column. Migration 0017 backfills with synthetic timestamps at `(ritual_month::date + interval '7 days')` — plausible mid-month ritual completion. New ritual completions (April onward) populate via `complete_monthly_ritual` / `complete_monthly_setup` RPCs as designed.

#### D.8 complete_monthly_setup enforces close-out sequence
Phase D hardening. Migration 0017 adds a precondition: setup for month M requires the M-1 ritual to be in `'completed'` status. Phase C1 frontend chains them correctly so this isn't a live bug, but a bad-faith client could bypass — precondition closes the gap.

#### D.9 PM_DECISIONS structured per-phase, not flat-numbered
Phase D. Adding ~30 amendments under existing Section B/C/D would collide with foundation-decision entries already at those numbers (e.g., existing C.1 = "JSX is quieter than instinct" vs Phase D spec's "C.1 WindfallFlow hybrid persistence"). Resolution: append a new top-level section `## Phase 3 Build Decisions (banked 2026-05-28)` with its own A-E subsections. Numbering inside the new section is scoped to it. Citations elsewhere should qualify as "Phase 3 Build C.7" / "Foundation C.1" to disambiguate.

#### D.10 ProfilePill `_avatar` prop removed
Phase D cleanup. Prop was unused after C4's localStorage-read shift. Two call sites updated (HomePage line 207, ChatPage line 133). Single source of truth: the `useEffect` localStorage read inside ProfilePill. No backward-compat surface remains.

#### D.11 Test script try/finally cleanup hygiene
Phase D fix. `scripts/phase05j-fix-race.mjs` inserts a real reflection mid-test. If the test throws mid-flight, the leftover persists (caught it twice during Phase C verification). Wrapped state-mutating sections in try/finally that restores canonical state on exit. Other phase scripts already had explicit cleanup paths at the bottom — verified via audit.

#### D.12 apply-migrations.js no-op warning suppressed
Phase D fix. The warning "v_demo_today substitution did not match" fires whenever `sql.replace(...)` returns an unchanged string. This happens both when the regex truly doesn't match AND when the replacement value equals the original — the common case on May 1 (seed already says `'2026-05-01'`, demoToday computes to `'2026-05-01'`). Fix: gate the warning on `!regex.test(before)` instead of `sql === before`. Cosmetic, no behavior change.

#### D.13 Lint baseline cleared
Phase D sweep. Baseline was 69 errors + 4 warnings = 73 problems (not the 44 cited in the spec — accumulated during Phase 3 build). Approach: ESLint config tweak to scope `no-restricted-syntax` (the `new Date()` ban routing to `src/lib/dates.ts`) to `src/**` only — Edge Functions are Deno runtime and can't import from `src/`. Plus manual address of unused-vars and `any`-types where straightforward. No refactors, no rule suppressions. Future verification gates use "zero new errors" as the bar.

#### D.14 CLAUDE.md updated with current state pointers
Phase D housekeeping. Updated project-documents section to reference PM_DECISIONS.md authoritatively. Added current-state pointer block calling out `phase-3-complete` tag, Priya demo state, and next steps. Future Claude Code sessions reading CLAUDE.md see the build state immediately.

---

### Section E — Phase 3 Disclosures + V2 Carry-overs

These are NOT decisions to litigate — they are documented known states of the Phase 3 build that V2 work would address. Listed for case-study honesty, reviewer transparency, and future maintainers.

#### E.3 Hallucination guard scope limited to verdict_line
Chat C3 verdict cards: guard runs against `verdict_line` only. `body`, `tradeoffs`, `best_next_step` are NOT separately verified. Grounded context (real Priya state) makes hallucination less likely, but the guard doesn't catch all of it. V2 hardening: extend guard to all four fields.

#### E.4 Verdict query "right now" trips timing filter
Acceptable per scope_filter charter. "Right now" matches timing-deflection regex and routes to SEBI handoff for some borderline cases. Not a bug — the filter is intentionally cautious. V2: smarter timing intent classifier.

#### E.5 Cold-call latency on verdicts: 6-15s
Vertex JWT mint pattern is slow on cold isolates. Same on onboarding synthesis (5-12s cold). V2: typing indicator copy + preload-on-input-focus.

#### E.6 Rapid-labeling residual race on Reflect patterns
Stream 0.5j-fix solved the diagnosed case; 2-3 labels in quick succession may still fire 2-3 Vertex calls instead of 1. Eventually consistent (last-write-wins). Manual ↻ refresh is the user-facing escape hatch. V2: debounce on labels or skip-if-in-flight.

#### E.7 forceResynthesizePatterns no spinner beyond "Running…" text
Reviewer Console action. Acceptable for reviewer-tools surface. V2 polish.

#### E.8 Ritual screen page title 30px is extrapolation
JSX preview canonical type scale is home + chat only. Ritual screen titles at 30px applied uniformly per Stream 0 type scale. V2: explicit ritual-screen type scale OR accept 30px as the locked spec going forward.

#### E.9 Onboarding doesn't auth-gate `/`
Logged-in user navigating to `/` sees Welcome again (skip button still works to re-login). V2: session check that auto-routes to `/home` if session present.

#### E.10 Edge Function `no-restricted-syntax` exempt via config
The `new Date()` ban in `src/**` doesn't apply to Edge Functions (Deno can't import from `src/lib/dates.ts`). ESLint config now scopes the rule to `src/**`. Edge Functions still use `new Date()` freely where needed.

#### E.11 WindfallAllocate sub-copy already dynamic
Pre-flight discovery — Stream 0.5k already made the sub-copy say `"the {buckets.length} buckets keep things..."`. Phase D spec listed this as a must-fix; it was already fixed. No action needed.

#### E.12 Cumulative test-script seed pollution pattern
April reflection leftovers surfaced 3 times across Phase B/C verification. Phase D added try/finally to the main culprit (`phase05j-fix-race.mjs`). V2: add global "reset reflections to canonical" sanity check before each verification batch.

---

## How this file evolves

When a new doc gets drafted, this file gets a corresponding entry. New decisions get added; superseded decisions get marked deprecated with a date and reason.

When a phase completes, the relevant section gets a "Status: shipped at commit X" annotation.

When a V2 idea gets pulled forward, the backlog entry moves to a real section.

This file is the case-study source-of-truth. CLAUDE.md is for engineering rules. PM_DECISIONS.md is for product opinions.
