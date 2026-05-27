# Phase 3 Completion Plan — Once and For All

This is the master plan for completing Phase 3 to full preview parity. It supersedes earlier piecemeal fidelity passes (Doc 1.15, 1.16) and consolidates everything into a single sustained build that ships Savio as the demo MVP the Behance reference and JSX preview specified from the start.

**Working principle:** The current build has been growing by accretion — partial visual fixes, partial ritual flows, missing surfaces (Reflect, Goals), conflated concepts (commitments vs categories). Each individual issue is small. The aggregate gap is meaningful. This plan ships everything as one coherent body of work, with explicit canonical references, dependency-ordered build sequencing, and verification gates that prevent further accretion.

**Timeline:** Sunday EOD target, Monday EOD acceptable, beyond that unacceptable.

**Scope discipline:** Zero scope expansion mid-build. Any newly-discovered drift gets documented as follow-up, not auto-fixed. The bar is "matches preview as specified by this plan," not "matches preview perfectly in every infinitesimal detail."

---

## Section 1 — Canonical references

### 1.1 Behance — visual system source of truth

The Credifyx Behance project (`docs/credifyx_behance_reference/`) is the canonical reference for:
- **Typography** — font family, type scale, line-height, weight rules
- **Color palette** — every hex value
- **Component vocabulary** — button shapes, card chrome, plate iconography, active-state treatments
- **Aesthetic principles** — restraint, hairline borders, color-as-accent

When the JSX preview and Behance conflict on visual treatment, **Behance wins.**

### 1.2 JSX preview — behavior and layout source of truth

`docs/savio_preview.jsx` (1,560 lines) is the canonical reference for:
- **Component composition** — what surfaces exist, what each contains
- **State machines** — multi-step flows (ritual, windfall, onboarding)
- **Data shape expectations** — what each component reads and renders
- **Interaction patterns** — taps, transitions, undo, confirmations
- **Copy** — exact strings for headers, button labels, body text (subject to refinements in this plan)

When the Behance and JSX preview conflict on behavior or layout, **JSX preview wins.**

### 1.3 Onboarding JSX — onboarding-specific reference

`docs/savio_onboarding.jsx` (1,347 lines) is the canonical reference for the 9-step onboarding walkthrough.

### 1.4 Data model document — what gets asked when

`docs/savio_data_questions.md` (226 lines) defines:
- The 7 onboarding-minimum inputs (functional in MVP)
- Progressive-disclosure fields (schema-present, asked just-in-time, mostly stub in MVP)
- Ritual-collected fields (recurring confirmations)
- Behavioral-capture fields (derived from action, not asked)

### 1.5 PM_DECISIONS.md — running decision log

All locked product decisions get banked in `PM_DECISIONS.md` at repo root. This includes the 26 decisions from the question phase that precedes this plan, plus the architectural decisions in this plan.

---

## Section 2 — Locked decisions (the foundational rule set)

These are non-negotiable for this build. Any deviation requires explicit revision of this section, not silent drift.

### 2.1 Visual foundation

1. **Font:** PP Neue Montreal (primary), Inter (fallback), system-ui (last resort)
   - CSS stack: `font-family: 'PP Neue Montreal', 'Inter', system-ui, -apple-system, sans-serif`
2. **Type scale:** Strict 56 / 36 / 24 / 16 with uniform 120% line-height
   - Heading 56px (hero numbers only — safe-to-spend, close-out finished-with)
   - Title 36px (page titles — Your Dashboard, Closing out April, etc.)
   - Subheading 24px (section emphasis — used sparingly)
   - Body 16px (everything else)
3. **Color palette:** #E4ECE6 background / #FFFFFF card / #1A1A1A primary text / #5F5E5A secondary / #888780 tertiary
   - Accents: #F4D123 yellow / #B2EF82 green / #FF8F8F red / #58B9FF blue
   - Plate tints: #FCF1CC yellow / #DEF2CB green / #FFE1E1 red / #DCEEFF blue
   - Strategist Navy #0C447C reserved for **avatar identity only** (Compass icon, identity pills, BottomNav active text color)
4. **Buttons:** Pure pill shape (border-radius: 999px), hairline 0.5px borders, no shadows
   - Primary CTA: background #1A1A1A near-black, white text
   - Secondary CTA: transparent, near-black text, 0.5px hairline border
   - Paired CTAs use `flex: 1` (equal width side by side)
5. **Card chrome:** Hairline borders only (no shadows, no elevations)
6. **Top-bar iconography:** Rounded-square plates (16px radius) — hamburger top-left, avatar top-right
7. **BottomNav active state:** Color + weight shift only (no background plate)
   - Active: T.avStop color, stroke weight 2.4, font weight 500
   - Inactive: T.t color, stroke weight 1.8, font weight 400
8. **No phone-frame chrome in product** — responsive mobile web

### 2.2 Ritual architecture

9. **Single combined 6-step ritual** (replaces earlier "coexist" two-ritual model)
   - Step 1: Close-out summary (M-1)
   - Step 2: Rollover allocation (M-1 → M)
   - Step 3: Income confirmation (M)
   - Step 4: Commitments scan (M)
   - Step 5: Focus goal selection (M)
   - Step 6: Lock-in (M)
10. **Step 2 → Step 3 transition:** Tactile button labeled "Set up May →" (or dynamic month equivalent)
11. **No welcome step** (per earlier decision)
12. **Ritual header layout:** Vertical stack — `[back arrow row]` then `[eyebrow row]` then `[title row]` — NOT horizontal flex
13. **Ritual header eyebrow:** "Monthly check-in · N of 6" format with dynamic step counter

### 2.3 Commitments vs categories distinction

14. **Schema migration 0012:** Add `is_fixed: boolean NOT NULL DEFAULT true` to commitments table
15. **Set is_fixed = false for:** Groceries, Eating out, Transport (the three variable spending categories)
16. **All other commitments stay is_fixed = true:** Rent, Personal loan EMI, SIPs (2), Parents transfer, Insurance, Utilities + subscriptions
17. **UI labeling:**
    - Close-out screen section: **"Where you spent"** (filters `is_fixed = false`)
    - Ritual Step 4 commitments scan: **"Your commitments"** (filters `is_fixed = true`)
    - Home commitments-on-track card: counts `is_fixed = true` only
    - Profile expansion "Your finances" section: lists `is_fixed = true` commitments

### 2.4 Month-naming logic

18. **Current month M = month being lived** (referenced by transactions, safe-to-spend, "For you today" insights)
19. **Previous month M-1 = month being closed out** (referenced by close-out summary, ritual Steps 1-2)
20. **Month-open content (ritual Steps 3-6) references M** (the just-opened current month)
21. **No hardcoded month names anywhere in rendered UI** — all month references derived from `dates.ts` helpers
22. **ResetActionRow shows dynamic month** — derived from `getMostRecentClosedRitualMonth()` or equivalent

### 2.5 Chat surface

23. **Chat disclaimer copy (locked):** "Savio is decision-support, not financial advice. Verify important calculations independently."
24. **Chat disclaimer styling:** Non-italic, T.t color, centered, font size 12-13px
25. **Chat input send button:** Dark T.p background, white arrow icon, small circular (~36-40px), sits inside the right edge of the input pill
26. **Chat input field:** Rounded-pill shape, 16px body text inside, T.s placeholder, integrated send button
27. **Structured response card pattern (Phase 5 in this plan):** Card with verdict line + body + Tradeoffs nested callout + Best next step affordance — to be built per JSX preview lines 404-583

### 2.6 Build discipline

28. **Restraint principle:** When the preview is quieter than instinct suggests, the preview wins. No "make it look more polished" emphasis additions.
29. **Source-first verification:** Before building any surface, Claude Code reads the corresponding JSX preview lines and Behance reference. No building from screenshots or interpretation.
30. **No scope expansion mid-build:** Discovered drift gets documented as follow-up, not auto-fixed. Audit findings ≠ scope expansion.

---

## Section 3 — Stream 0: Visual foundation (prerequisite for everything)

Stream 0 is the foundation upon which every per-surface build sits. It must complete and verify before any per-surface work begins. Estimated 6-8 hours.

### 3.1 Font installation

- Install PP Neue Montreal trial version from Pangram Pangram Foundry
- Self-host font files in `public/fonts/` (Regular + Medium weights minimum)
- Set up `@font-face` declarations in global CSS
- Update `src/index.css` (or equivalent root stylesheet) to set font-family on `html` and `body`
- Add fallback chain: PP Neue Montreal → Inter → system-ui → -apple-system → sans-serif
- Verify font loads correctly in dev mode and in build
- License documentation: drop a `LICENSE_FONTS.md` in `public/fonts/` referencing Pangram Pangram trial license terms

### 3.2 Type scale unification

Update `src/lib/design-tokens.ts` to add explicit type scale:

```ts
export const typography = {
  heading: { fontSize: 56, lineHeight: 1.2, fontWeight: 500, letterSpacing: '-1.5px' },
  title: { fontSize: 36, lineHeight: 1.2, fontWeight: 500, letterSpacing: '-0.8px' },
  subheading: { fontSize: 24, lineHeight: 1.2, fontWeight: 500, letterSpacing: '-0.3px' },
  body: { fontSize: 16, lineHeight: 1.2, fontWeight: 400 },
  bodySm: { fontSize: 14, lineHeight: 1.2, fontWeight: 400 },  // for caption/secondary text
  caption: { fontSize: 12, lineHeight: 1.2, fontWeight: 400, color: 't' },
  microCaption: { fontSize: 11, lineHeight: 1.2, fontWeight: 400, color: 't' },
};
```

Then sweep every visible surface to use these tokens. Doc 1.15 and 1.16 used custom sizes (30, 28, 26, 15, 14.5, 13, 12.5, etc.) — these get unified to the canonical scale.

**Page titles drop from 30px to 36px.** Hero numbers stay at 56px (already correct). Body text shifts from 14-15px to 16px. Captions shift from 12.5-13px to 12px.

### 3.3 Top-bar plate iconography

Per Behance mockups, the top-bar elements sit in rounded-square plates:
- **Avatar pill (top-right):** White rounded-square plate (40×40, border-radius 12-14), Compass icon inside (T.avStop color, 18px stroke 2)
- **No hamburger menu in current Savio layout** — preview uses a Compass top-right only

Verify current implementation matches. Bank the spec for plate dimensions.

### 3.4 Pill button shapes audit

Grep every `<button>` in src/ and verify:
- `border-radius: 999px` (full pill)
- `border: 0.5px solid` (hairline) for outlined variants
- No `box-shadow` properties
- Paired CTAs (Allocate now / Skip for now, etc.) use `flex: 1`
- Primary buttons: background T.p, color white
- Secondary buttons: transparent background, T.p text, hairline border

### 3.5 BottomNav active state correction

Per Section 2.1 item 7, remove the active-state plate. Update `src/components/BottomNav.tsx`:
- Remove `bg-[#DCEEFF]` (avPlate background) from active tab
- Active = T.avStop color + Icon strokeWidth 2.4 + label fontWeight 500
- Inactive = T.t color + Icon strokeWidth 1.8 + label fontWeight 400

### 3.6 Chat input + disclaimer fix

Per Section 2.5:
- Send button: T.p circular background, white arrow icon
- Disclaimer: non-italic, T.t color, exact locked copy
- Input field: 16px body text

### 3.7 Ritual header vertical stack

Update `src/components/ritual/RitualHeader.tsx` (or wherever the shared ritual header lives) to use vertical stack layout:
```tsx
<div>  {/* row 1: back arrow alone, left aligned */}
  <ArrowLeft />
</div>
<div>  {/* row 2: eyebrow */}
  Monthly check-in · {step} of 6
</div>
<div>  {/* row 3: title 36px */}
  {title}
</div>
```

### 3.8 Month-name derivation grep

Grep `src/` for hardcoded month strings: "April", "May", "Jan", "Feb", etc.
- Document every match
- Verify each is dynamic (derived from `dates.ts`) or replace with derivation
- Expected zero hardcoded month names in rendered UI after sweep

### 3.9 Card padding final audit

Doc 1.16 tightened defaults. Verify against the preview now that Behance reference is in hand:
- Default card: 16px padding (was p-4 = 16px, should match)
- Hero card: 20px padding (was p-5 = 20px, should match)
- Inset card: 12px padding (was p-3 = 12px, should match)

Most likely no change needed — surfaces for spot-check during Stream 0 audit.

### 3.10 Stream 0 verification gates

- **Gate 1 — Font installed:** PP Neue Montreal renders on home page (visual check), Inter renders as fallback when font load fails (network throttle test)
- **Gate 2 — Type scale unified:** Page titles render at 36px, hero numbers at 56px, body at 16px (browser inspect)
- **Gate 3 — BottomNav corrected:** Active tab shows color + weight shift, no plate
- **Gate 4 — Chat input + disclaimer:** Send button dark, disclaimer non-italic, copy locked
- **Gate 5 — Ritual header:** Vertical stack on all 3 existing ritual screens
- **Gate 6 — Month names dynamic:** Grep returns zero hardcoded month names in rendered code paths
- **Gate 7 — Button pill audit:** All buttons full-pill, hairline borders, no shadows, paired CTAs flex-1
- **Gate 8 — Regression:** 7/7 chat audit passes, doc1.1-verify passes, ritual walkthrough works, tsc clean

---

## Section 4 — Surface inventory

### 4.1 What exists vs what's missing

| Surface | Status | Reference | Hours |
|---|---|---|---|
| **Home page** | ✅ Built, minor fidelity items addressed by Stream 0 | JSX 158-403, Behance mockup #2 | 0 (Stream 0 covers) |
| **Chat (prose responses)** | ✅ Built, fidelity in Stream 0 | JSX 404-583, current build | 0 (Stream 0 covers) |
| **Chat (structured response cards)** | ❌ Missing | JSX 404-583 (verdict/Tradeoffs/Best-next-step pattern) | 6-8 |
| **Reflect** | ❌ Placeholder only | JSX 584-684 | 4-5 |
| **Goals** | ❌ Placeholder only | JSX 689-776 | 4-5 |
| **Profile** | ⚠️ Partial (~30% built) | JSX 781-906 | 3-4 (expansion) |
| **WindfallFlow** | ⚠️ Status to verify in Stream 0 audit | JSX 931-1118 | 4-5 if needed |
| **MonthlyRitual** | ⚠️ 3 of 6 steps exist | JSX 1119-1372 + integration | 6-8 |
| **Doc 1.2 split rollover** | ⏸ Pre-flighted, ready to resume | Already drafted spec | 5-6 |
| **Onboarding walkthrough** | ❌ Not built | `savio_onboarding.jsx` | 5-6 |

**Total remaining estimated effort: 37-47 hours after Stream 0.**

### 4.2 Per-surface specifications (separate documents)

Each per-surface build is a standalone document Claude Code works through in sequence. The master plan references them; the per-surface specs are drafted as separate files in sequence:

- `claude_code_phase3_doc12_split_rollover.md` — already drafted, ready to resume after Stream 0
- `claude_code_phase3_doc20_reflect_surface.md` — to be drafted
- `claude_code_phase3_doc21_goals_surface.md` — to be drafted
- `claude_code_phase3_doc22_profile_expansion.md` — to be drafted
- `claude_code_phase3_doc23_ritual_6step.md` — to be drafted, integrates Doc 1.2's rollover as Step 2
- `claude_code_phase3_doc24_windfall_audit.md` — to be drafted after Stream 0 audit findings
- `claude_code_phase3_doc25_onboarding_walkthrough.md` — to be drafted
- `claude_code_phase3_doc26_chat_structured_cards.md` — to be drafted

---

## Section 5 — Ritual architecture in detail

### 5.1 The 6-step combined flow

The single ritual triggered on the 1st of each month (or anytime if not yet completed) sequences through:

**Step 1 — Close-out summary (M-1)**

References: existing `MonthlyRitualCloseOut.tsx`, refined per Section 2.3 commitment-vs-category labeling
- Header: "Monthly check-in · 1 of 6" / back arrow + close X / Title "Closing out April"
- Hero card: "YOU FINISHED WITH ₹X" (M-1 net leftover)
- Section "Where you spent" (variable categories — `is_fixed=false`)
  - Eating out / Transport / Groceries with budgeted vs actual + variance pill
- Section "Discretionary leftover" (computed total)
- Section "Looking back" (reflection prompts for unlabeled M-1 high-impact transactions)
- Continue button → Step 2

**Step 2 — Rollover allocation (M-1 → M)**

References: Doc 1.2 split rollover spec (already drafted)
- Header: "Monthly check-in · 2 of 6" / back arrow / Title "Where should it go? / April's ₹X"
- Multi-destination allocation rows with amount entry
- "+ Add destination" button
- Allocation indicator (sum vs target)
- Confirm button labeled **"Set up May →"** (tactile transition per decision 10)
- On confirm: writes rollover_allocations rows + commitment_id mappings, transitions to Step 3

**Step 3 — Income confirmation (M)**

References: JSX preview 1205-1248
- Header: "Monthly check-in · 3 of 6" / Title "Income for May"
- Salary credited card: "₹68,500 / 1 May 2026 · 09:14 AM · HDFC" (Priya's seeded salary, dynamic month)
- Question: "Did you receive any other income this month?"
- Two buttons: "No, just salary" (default selected, navy border) / "Yes, let me add" (outline)
- Continue button → Step 4
- **Note:** "Yes, let me add" can be `[PRESENTATIONAL]` for V1 — opens a stub modal or shows "Coming soon" toast. Real income-addition flow is V2.

**Step 4 — Commitments scan (M)**

References: JSX preview 1252-1284, filtered to `is_fixed=true`
- Header: "Monthly check-in · 4 of 6" / Title "Your commitments"
- Subtitle: "A quick scan of what's committed. Tap to adjust any that changed."
- Card with all `is_fixed=true` commitments listed (Rent, Personal loan EMI, SIPs, Parents, Insurance, Utilities)
- Each row: label + amount + "Same" affordance (tap to adjust — `[PRESENTATIONAL]` for V1, opens modal that says "Coming soon")
- Footer callout: "Total: ₹X/month. This leaves ₹Y as base monthly slack before goals."
- "Looks right" button → Step 5

**Step 5 — Focus goal selection (M)**

References: JSX preview 1287-1332
- Header: "Monthly check-in · 5 of 6" / Title "Your focus this month"
- Subtitle: "Pick one. You can change it any time this month."
- 4 selectable cards (Phone fund / Emergency fund / Goa trip / No specific focus)
- Active = navy 1.5px border + checkmark icon in filled navy circle
- Inactive = 0.5px border + empty circle
- Continue button → Step 6
- **Backend:** writes `focus_goal_id` to `monthly_rituals` row

**Step 6 — Lock-in (M)**

References: JSX preview 1335-1372
- Header: "Monthly check-in · 6 of 6" / Title "Your May is set."
- Hero card: "Safe to spend in May" + ₹X (computed) + gradient bar
- Body: "That's ₹Y/day across N days. Your focus this month is the [goal name]."
- Sage callout: "Savio will check in again on 1 June. You can ask anything in chat anytime before that."
- "Lock it in" button → completes ritual, returns to Home

### 5.2 State management

`monthly_rituals` table extends to track partial completion:
- Add column: `current_step int NOT NULL DEFAULT 1` (1-6 representing current step)
- Add column: `closed_out_at timestamp` (when Step 1 completed)
- Add column: `rolled_over_at timestamp` (when Step 2 completed)
- Add column: `month_locked_at timestamp` (when Step 6 completed)
- `completed_at` set when Step 6 finishes (final)
- Existing `close_out_snapshot` jsonb continues as canonical record

This enables resume-from-step-N if user bails mid-flow.

### 5.3 Trigger logic

Home page ritual banner appears when:
- `current_step < 6` for any month_year where the month has actually started or ended
- Specifically: if today is M (e.g., May), and `monthly_rituals` row for M-1 doesn't have `current_step=6`, show banner

Banner copy:
- If `current_step = 1` (not started): "Your monthly check-in is ready"
- If `current_step = 2-5`: "Continue your monthly check-in"
- If `current_step = 6`: banner disappears

### 5.4 Integration with Doc 1.2 split rollover

Doc 1.2 was drafted as a standalone update to the rollover screen. With the 6-step architecture, Doc 1.2's deliverables fit cleanly as Step 2:
- Migration 0011 (drop rollover_allocation_id, multi-allocation pattern) still applies
- RPC `complete_monthly_ritual` accepts jsonb array of allocations — still applies
- Doc 1.2's new components (AllocationRow, multi-destination picker) become Step 2 components

When the ritual spec (Doc 23) is built, it imports Doc 1.2's components for Step 2. Doc 1.2 ships first (it's pre-flighted), the ritual spec composes them.

---

## Section 6 — Build sequence

Strict dependency-ordered list. Each phase verifies before the next starts.

### Phase A — Foundation (Wednesday → early Thursday)

**A1. Stream 0 (visual foundation)** — 6-8 hours
- Font installation
- Type scale unification
- Component vocabulary cleanup (buttons, BottomNav, chat input, ritual header)
- Month-name derivation grep
- Card padding audit
- Card density verification
- All gates pass

**A2. Schema migration 0012** — 30 minutes
- Add `is_fixed` boolean to commitments table
- Set is_fixed=false for Groceries/Eating out/Transport
- Verify queries work
- This blocks the close-out section relabeling and ritual Step 4 — must complete in Phase A

**A3. Doc 1.2 resumption** — 5-6 hours
- Resume the pre-flighted Doc 1.2 split rollover work
- Migration 0011, RPC updates, AllocationRow component, Rollover screen redesign
- Verification gates per Doc 1.2 spec
- Output: working split rollover at month-end (currently the rollover screen in the 3-screen ritual)

**Phase A total: ~12-15 hours. Target completion: Thursday morning.**

### Phase B — Standalone surfaces (Thursday → Friday morning)

These can build in any order; sequenced by complexity-build-confidence.

**B1. Profile expansion** — 3-4 hours
- "Your finances" section (Monthly income, Anchor date, Primary bank)
- "Your rules" section (Buffer floor, Impulse purchase wait, Avatar)
- Full Disclaimer card with acknowledgment date
- Missing reviewer rows (View seed CSV, Read case study, View divergence tests)
- About section + footer

**B2. Reflect surface** — 4-5 hours
- Full standalone page (replaces placeholder)
- Glad/Neutral/Regret label buttons per row
- Undo affordance on labeled rows
- Footer text "Reflections train Savio's regret-rate signal. No reminders, no nags."
- Query unlabeled transactions of recent significance
- Backend RPC to write reflection

**B3. Goals surface** — 4-5 hours
- Per-goal cards with status pills, current/target, progress bar, milestone callouts
- "Add a goal" button (`[PRESENTATIONAL]` for V1 — opens "Coming soon" toast or stub modal)
- Read from existing `goals` table

**Phase B total: ~11-14 hours. Target completion: Friday late afternoon.**

### Phase C — Complex flows (Friday evening → Sunday)

**C1. MonthlyRitual 6-step integration** — 6-8 hours
- Refactor existing close-out into Step 1 of new flow (incorporating "Where you spent" label fix)
- Integrate Doc 1.2's components as Step 2
- Build Step 3 (income confirmation), Step 4 (commitments scan with `is_fixed=true` filter), Step 5 (focus goal), Step 6 (lock-in)
- State management updates (`current_step`, completion timestamps)
- Trigger logic on home banner
- "Set up May →" tactile transition button on Step 2
- All steps inherit Stream 0 typography and component vocabulary

**C2. WindfallFlow audit + spec + build** — 4-5 hours
- Audit current state: what's built, what's missing
- If missing: build per JSX preview 931-1118 (allocate sliders + review screen)
- Slider-based allocation across 4 buckets (Emergency / Phone / Loan / Free)
- Auto-rebalance free-spend on slider drag
- Confirm + lock-in step

**C3. Chat structured response cards** — 6-8 hours
- Verdict line (GREEN/AMBER/RED based on AI response)
- Body content
- Tradeoffs nested callout
- Best next step affordance card
- Replace current prose-only response display when response shape matches structured format
- Per JSX preview 404-583

**C4. Onboarding walkthrough** — 5-6 hours
- 9-step state machine per `savio_onboarding.jsx`
- React state only (no DB writes for the walkthrough itself — Priya is pre-seeded)
- Framing 3 dual-honesty signal (subtitle on welcome button + interstitial before auto-login)
- Welcome screen → Data source choice → Statement upload (presentational) → SMS permission → Avatar → Life stage + anchor → Focus goal → Disclaimer → Auto-login as Priya

**Phase C total: ~21-27 hours. Target completion: Sunday EOD.**

### Phase D — Verification (Monday morning)

**D1. Full audit pass** — 2 hours
- Screenshot every surface
- Compare against Behance + JSX preview
- Document any remaining drift as follow-up (NOT auto-fix)
- Verify 7/7 chat audit, ritual walkthrough, doc1.1-verify

**D2. Final commit + push + tag** — 30 minutes
- Push all unpushed commits to origin
- Tag `phase-3-complete`
- Update CLAUDE.md with current state pointer

**Phase D total: ~2.5 hours. Target completion: Monday morning.**

### Total project hours

- Phase A: 12-15 hours
- Phase B: 11-14 hours
- Phase C: 21-27 hours
- Phase D: 2.5 hours

**Grand total: ~47-58 hours of Claude Code work.**

**Working day capacity:** Realistic sustained Claude Code work is ~8-10 hrs/day. Wed evening (~3hrs) + Thu (10hrs) + Fri (10hrs) + Sat (10hrs) + Sun (10hrs) + Mon morning (3hrs) = 46 hours available.

**Math is tight but achievable** with disciplined sequencing and no scope expansion mid-build. The Sunday EOD target is realistic only if Phase A completes cleanly Thursday morning. If Phase A slips, Sunday becomes Monday EOD.

---

## Section 7 — Verification model

### 7.1 One gate per surface

Each per-surface build has its own verification gates (defined in the per-surface spec). The plan ships only when all surfaces pass their gates.

### 7.2 Standard verification checks per surface

For every surface built, Claude Code reports:
- Component renders correctly per JSX preview reference (line numbers cited)
- Behance design language applied (font, type scale, button shapes, colors)
- Data wiring works (no placeholder data unless explicitly `[PRESENTATIONAL]`)
- 7/7 chat audit still passes
- doc1.1-verify still passes
- tsc clean
- No newly-introduced lint errors beyond 44-error baseline

### 7.3 Audit pass (Phase D)

Final check before declaring complete:
- Screenshot every surface as a user would see it
- Side-by-side comparison against preview JSX rendering
- Document any drift found — categorized as:
  - **Fix now** (small enough to address in the audit pass itself)
  - **Defer to V2** (documented honestly as known gap)

The discipline: audit findings ≠ scope expansion. The plan ends when verified.

---

## Section 8 — What gets banked to PM_DECISIONS.md after this lands

A new section in PM_DECISIONS.md titled "Phase 3 Completion Architecture" containing:

1. The 30 locked decisions from Section 2 above
2. The 6-step ritual architecture (Section 5)
3. The is_fixed schema decision (Section 2.3)
4. The month-naming logic table (Section 2.4)
5. Reference priority rules (Behance > JSX for visual; JSX > Behance for behavior)
6. The "restraint principle" (preview wins when quieter than instinct suggests)
7. The "source-first verification" principle (read JSX before building)

This consolidates all decisions so future phases don't re-litigate them.

---

## Section 9 — Risks and contingencies

### 9.1 Highest risk: Stream 0 takes longer than 8 hours

Font installation can hit unexpected issues (CDN failures, license-file format quirks, browser cache invalidation). Type scale unification touches every surface — small mistakes propagate.

**Mitigation:** Stream 0 has its own gate-pass before Phase B begins. If Stream 0 slips past Thursday morning, Phase B starts late but proceeds on the corrected foundation.

### 9.2 Medium risk: WindfallFlow current state unknown

We haven't verified what currently exists for WindfallFlow. If nothing exists, that's 4-5 more hours. If partial, less.

**Mitigation:** Phase A's audit pass surfaces this. Phase C plan adjusts accordingly.

### 9.3 Medium risk: Chat structured cards more complex than estimated

Restructuring chat to render structured response cards (verdict/Tradeoffs/Best-next-step) when the response shape matches involves parsing AI output and detecting the structured pattern. The current chat is prose-only.

**Mitigation:** If chat structured cards slip, this is the single safest cut. The current build's prose chat works. Structured cards become "documented as Phase 5 enhancement, deferred from Phase 3 demo."

### 9.4 Lower risk: Onboarding walkthrough rendering issues

9 screens of new code. State machine. Each screen could have its own typography/layout issues that surface late.

**Mitigation:** Standard verification per surface. Onboarding lands last so its issues don't block other surfaces.

---

## Section 10 — Operating discipline

While this plan executes, the following operating discipline applies:

1. **No fidelity dribble.** No "while we're here, let's also fix..." additions. Each per-surface build hits its spec and stops.
2. **Source-first.** Claude Code reads JSX preview lines + Behance reference before writing code for each surface.
3. **Honest scoping.** If a surface is bigger than estimated, surface it before continuing. The plan adapts; doesn't get blindsided.
4. **Verification at each gate.** Each surface verifies before the next starts. No "we'll come back to fix" deferrals within the plan.
5. **The audit pass is the audit pass.** Found drift gets documented, not fixed (except trivially). The plan ends when verified, not when perfect.

---

## Appendix A — Reference materials in repo

After this plan begins execution:

- `docs/savio_preview.jsx` — canonical layout/behavior reference (already present)
- `docs/savio_onboarding.jsx` — canonical onboarding reference (already present)
- `docs/savio_data_questions.md` — data model (already present)
- `docs/credifyx_behance_reference/` — Behance images (typography, mockups, color system)
- `PM_DECISIONS.md` — running decision log (at repo root)
- `CLAUDE.md` — engineering rules (existing, updated with Phase 3 Completion pointer)

---

## Appendix B — How to use this plan

For Claude Code, in order:

1. Read this entire document first
2. Read the canonical references (Behance images, JSX preview, data model document)
3. Execute Phase A1 (Stream 0)
4. Verify all Stream 0 gates pass
5. Execute Phase A2 (migration 0012)
6. Execute Phase A3 (Doc 1.2 resumption — separate spec document)
7. Wait for Ritika to send the per-surface spec for the next surface (B1 Profile expansion)
8. Continue through Phase B, C, D in sequence
9. Each per-surface spec is a separate document; Claude Code does not need to know the next one until Ritika sends it

For Ritika:

1. Verify Stream 0 visually after Phase A1 completes
2. Resume Doc 1.2 after Phase A2 completes
3. Draft per-surface specs (with Claude's help) in sequence
4. Send each per-surface spec to Claude Code after the previous one verifies
5. Visual review at each surface completion before sending next

---

**End of master plan. Per-surface specs follow as separate documents.**
