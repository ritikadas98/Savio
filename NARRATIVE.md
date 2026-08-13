# Savio — the case study, in plain English

> A companion to [PM_DECISIONS.md](./PM_DECISIONS.md). That file is the source-of-truth for every design call, with all the technical detail. This one is the story of *why*, for a reader who doesn't want to read 100KB of jargon to understand the shape of the project. Every claim here that could be doubted links back to a specific PM_DECISIONS entry so you can audit any part of the story.

---

## What Savio is

Savio is an AI-assisted financial companion for in-between-income earning Indians — people who make ₹40,000 to ₹1,20,000 a month in Tier 1 and Tier 2 cities, have real financial obligations but also real discretionary room, and want a tool that helps them think without overriding their decisions.

The core insight isn't the AI. The core insight is **when** the help shows up.

## The problem: budget apps fail at the moment of decision

Every existing budget app assumes the user will consult a dashboard before they spend money. Nobody does that. Nobody pauses in a Zara fitting room to open an app and check whether ₹3,500 is "okay." By the time you're at the checkout screen, the decision is already emotional.

The apps that try to intervene *at* the decision — pop-up warnings, spend blockers, mid-checkout nudges — get uninstalled in a week. Nobody wants to be scolded by their phone.

So the whole category has been fighting the wrong fight.

## The insight: help lands at the seams between months

Awareness doesn't work at the decision. It works at **book-ending moments** — the natural pauses in the money cycle when a person is *already* in a reflective state and the app can be useful without being annoying:

- **The 1st of the month, when salary lands.** A "close-out" of the month just gone + a "set-up" of the month ahead. Not a nag; a ritual.
- **A windfall arrives.** Diwali bonus, tax refund, salary raise. Unallocated money has a very short half-life. Book-end it before it dissolves into background spending.
- **A few days after a purchase.** The regret has landed, or hasn't. Label the transaction "worth it" or "regret" while the feeling is still real. Patterns emerge over time.

That's Savio's thesis in one sentence: **help lands at the book-ends, not at the decision itself.** Everything else follows from that.

## The user: Priya

The demo runs against a synthetic seeded user — Priya Sharma. She earns ₹98,000 net per month, supports her parents (₹8,000/month), pays ₹22,000 rent, has three savings goals (a phone fund, an emergency fund at ₹1.84L climbing toward ₹3L, a Goa trip), and has ₹15,000 auto-debited every month into two SIPs. Her free-to-spend money after all committed outflows is about ₹26,500 — which sounds like plenty until you look at what a Tier 1 city costs to actually live in.

She's not the poorest user Savio would serve. She's not the richest. She's the middle where the discipline is hardest and the tools that exist today are worst — the "in-between-income" band. Everything Savio does is calibrated for her shape.

## The demo tour — five surfaces

Open the [live demo](https://savio.ritikadas.in/) and tap "Continue as Priya." You land in:

1. **Home.** The number at the top says **₹26,532 safe to spend this month** — that's what's left after fixed costs, investing commitments, and goal contributions. Below it, the current month's ritual, upcoming bills, recent transactions, a card for the reflection loop.
2. **Chat.** Ask "Can I afford a ₹3,500 watch?" and you get a *structured verdict* — a color (yellow/red/green), a one-line summary, a body that explains the math, 2–4 tradeoffs with actual numbers, and a next step. Not a paragraph of hedging. Not a generic "it depends."
3. **Reflect.** A list of recent purchases waiting for you to label them "worth it," "neutral," or "regret." After you have a handful labeled, tap "Show my reflections" and Savio surfaces patterns — *"7 of 8 Myntra purchases marked regret, 87.5%."*
4. **Goals.** Progress tracking, per goal, with contribution amounts.
5. **Profile.** Priya's finances laid out as a decomposition — income, fixed costs, investing (labeled *savings*), goals, and the derived safe-to-spend. Plus her savings position: the safety net rule (₹1,00,000), what's backing it (the Emergency fund), and the *cushion* above it (₹50,000 of unearmarked liquid — the only spendable buffer).

The monthly ritual is the seventh surface — a 7-screen flow that walks Priya through closing the previous month (with math, patterns, and a constructive "here's what to do next month" card) and setting up the new one.

## The five things Savio adds over a plain chatbot

This is Savio's answer to *"isn't this just ChatGPT with a finance skin?"* The [divergence tests artifact](./docs/divergence-tests.md) runs the same questions through Savio and through vanilla Gemini and shows the differences directly. In plain English:

1. **It knows her real numbers.** Ask a chatbot "can I afford a ₹35,000 laptop?" and it says *"depends on your finances."* Savio says *"you have ₹26,532 safe to spend this month; this exceeds it by ₹8,468 and would draw from your ₹50,000 cushion, dropping it to ₹41,532. Rebuilding takes ~1 month."*
2. **It uses a fixed structure.** Every prose answer is *where you stand → what it means → what you can do*. Every verdict is *color → one-liner → body math → tradeoffs → next step*. A reader learns the shape once and reads faster forever.
3. **It refuses out-of-scope questions.** Ask "which mutual fund should I invest in?" and Savio says *"outside what I can help with — you'd want a SEBI-registered advisor."* No horoscope-style hedging.
4. **It checks its own arithmetic.** Every rupee/percentage the model states gets verified against Priya's grounded numbers before the response ships. If a number can't be derived from her data, the structured response is dropped and a prose fallback runs. (Details in [E.3](./PM_DECISIONS.md#e3-hallucination-guard-scope-limited-to-verdict_line--resolved-by-d18) — and see the *self-audit* section below for the story of me getting E.3's scope wrong twice in the same file.)
5. **It carries context across turns.** Ask about a ₹5K watch, then an ₹8K watch, then add a ₹1L Apple Watch — turn 3 correctly says *"combined ₹1,08,000 — that's ₹81,468 over your safe-to-spend for the month, and would push you below your ₹1,00,000 safety net."* Vanilla treats each turn in isolation.

## The four hardest design calls

Everything else is table stakes. These four are where the case study lives:

### 1. Intervene at book-ends, not at decisions

Locked in **Foundation Decision #1** in PM_DECISIONS. Sounds obvious in retrospect. Wasn't obvious for the first month of design — the temptation to build "would you like to think about this before checkout?" is enormous, because it feels like helping. Realizing it's *actually* what makes budget apps get uninstalled took a specific PM commitment: **no mid-purchase interventions, ever.**

### 2. Deduct SIPs from safe-to-spend, even though they're "savings"

The four-spec [savings model stack](./PM_DECISIONS.md#d64-investing-commitments-deducted-from-safe-to-spend--savings-model-spec-1-revises-d63) works through a specific confusion: an SIP is *not a cost* (it's savings — the user's future self is the beneficiary), *and* it's *not spendable this month* (it auto-debits on payday). Both true. The pre-fix version encoded only the first — an ₹15K SIP sat inside the "safe to spend" number, overstating Priya's real headroom by ₹15,000.

Deducting it and showing it in a "savings" bucket rather than a "cost" bucket resolves both truths. Small change, correct answer, restores honesty about how much the user actually has to spend.

### 3. The cushion is not a green light

When a user has money saved above their safety net — a real buffer they could technically dip into for a big purchase — a naive assistant says *"you can afford it because you have savings."* That erodes the whole discipline. Every big purchase becomes rationalizable.

Savio's rule ([D.66](./PM_DECISIONS.md#d66-buffer-aware-verdicts--spec-3)): the cushion enters verdicts as a **tradeoff with a rebuild cost, never as permission.** A purchase that fits in the cushion moves from RED toward YELLOW — but never to GREEN. The response names the cost: *"drops your cushion from ₹50,000 to ₹41,532 — one month to rebuild at ₹26,532/month savings rate."* The user still gets to make the call. They just make it with the cost visible.

### 4. Cut the LLM surface where you can — guard it where you must

**D.40** is Savio's central prompt-engineering discipline: if a fact can be computed deterministically, compute it in code and inject it into the prompt as a fixed value the model must use verbatim. Don't let the model do arithmetic if you can help it.

Where the LLM is the surface — prose descriptions of Priya's situation, verdict wording, tone — you *guard* it: an arithmetic verifier checks every rupee value before the response ships. Where the LLM doesn't need to be the surface — the day count, the daily safe-to-spend, the income decomposition — you *cut* it. The model gets the answer as a fact.

This distinction saved the divergence tests. On the first run, the model was fabricating day counts (29, 30, 31 in the same session). Extending the arithmetic guard wouldn't have caught it — a fabricated day count isn't an arithmetic hallucination, it's just a wrong calendar fact. Cutting the surface — injecting "30 days remaining, use this verbatim" — fixed it structurally.

## What I got wrong along the way

The single most useful part of any case study is the mistakes.

The one I keep coming back to: **the code drifts *ahead* of the documentation, and the docs never catch up on their own.**

Concrete example: **D.18** shipped an arithmetic hallucination guard that runs against every field of a verdict (headline, body, tradeoffs, next-step). The disclosure entry I wrote at Phase 3 close (**E.3**) said the guard *only* ran on the headline. That was already wrong when I wrote it. Six weeks later, when I built the deterministic-injection fix (**D.63**), I *cited* the wrong disclosure as justification — *"the guard covers headline only, so nothing catches body drift."* Wrong twice. Then the [divergence test artifact](./docs/divergence-tests.md) — the very artifact designed to demonstrate Savio's honesty — printed *"body figures grounded but not separately guard-verified (E.3)"* on every single result, contradicting its own proof.

The pattern is clear once you name it: docs get written *when a decision is made*. Code gets rewritten *when the code changes.* If a later change strengthens the code without triggering a doc-review pass, the doc stays at the older, weaker claim. Discipline fails silently.

I caught this — actually, another Claude Code session caught it in a code audit — and it's now fixed. The E.3 entry is marked RESOLVED with a dated correction. The divergence test artifact says what the code actually does. But the real lesson is: **an audit trail is only as honest as its most recent pass.** I want a way to detect this automatically in V2 — probably a lint that greps PM_DECISIONS for "V2" and "remains" and flags them when the referenced code path is stronger than the disclosure.

I'd rather ship a case study that names this than one that hides it.

## What V2 looks like

If Savio ever went from portfolio piece to real product, four things would change first:

1. **Real bank data.** The current build has manual/statement-upload as `[DOCUMENTED-FAKE]` surfaces — honest labels for "we haven't wired this yet." Production would use India's Account Aggregator framework, which is a months-long integration project with RBI-registered partners.
2. **Multi-tenant onboarding.** Real signup, real user profiles, RLS hardening. Priya stays as the demo user for reviewers; other users get their own accounts. Doable with the current codebase in ~2 weeks of focused work.
3. **A semantic hallucination guard.** The current guard checks that numbers are arithmetically derivable from grounded inputs. It doesn't check that *claims* are semantically supported. A statement like *"your safety net will grow to ₹5L by December"* passes if the numbers are plausible, even if the claim isn't grounded. This is the real E.3 open item, cleanly stated.
4. **Regulated language enforcement.** The prompt tells the model not to say "green light" or "dipping into your safety net." Language compliance is a real risk in a SEBI-adjacent product; the discipline currently lives in text, not in code. A programmatic classifier (same shape as the number guard) would convert *"we tell the model"* into *"we verify the model."*

None of these change the thesis. They change the trust surface.

## Where to dig deeper

Everything above is claim; every claim links to receipt in [PM_DECISIONS.md](./PM_DECISIONS.md). The most audit-worthy entries, if you want to open the file with a specific target:

- **Foundation #1** — the book-ending principle
- **[D.64](./PM_DECISIONS.md#d64-investing-commitments-deducted-from-safe-to-spend--savings-model-spec-1-revises-d63)–[D.66](./PM_DECISIONS.md#d66-buffer-aware-verdicts--spec-3)** — the four-spec savings model stack
- **[D.63](./PM_DECISIONS.md#d63-deterministic-grounding-injection-for-derived-figures--canonical-income-decomposition)** — the cut-the-surface pattern in action
- **[E.3](./PM_DECISIONS.md#e3-hallucination-guard-scope-limited-to-verdict_line--resolved-by-d18)** — the resolved disclosure + the self-audit story
- **[docs/divergence-tests.md](./docs/divergence-tests.md)** — the "Savio vs. vanilla Gemini" evidence artifact, regenerated on every code change

If you're a hiring manager reading this, the meta-signal is: **every decision is traceable, and I audit my own audit trail.** The build discipline is the point.

If you're a future me: don't build a fourth project.
