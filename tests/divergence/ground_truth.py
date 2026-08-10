"""Deterministic ground truth for Priya, read off supabase/migrations/0006_seed_priya.sql.

This is the "code" half of the figure-traceability test (see README.md in this
folder). Every figure the product is allowed to show a user must be computable
here, in ordinary arithmetic, with no model involved. Nothing here calls an LLM and
nothing here is random.

Cross-check that this file is right: safe-to-spend below computes to 26,532, which
is the same number the live chat-respond endpoint reported in
docs/divergence-tests.md. Two independent paths landing on the same figure is the
reason to trust the rest.

The randomly generated filler transactions in the seed are deliberately NOT used as
ground truth: their amounts come from random() at migration time, so they differ
between runs and cannot be asserted against. Only explicitly seeded rows are used.
"""

import math
from dataclasses import dataclass

DEMO_TODAY = "2026-04-15"

# ── profile (seed lines 24-39) ─────────────────────────────────────────────────
MONTHLY_INCOME_GROSS = 125000.00
MONTHLY_INCOME_NET = 98000.00

# ── fixed commitments (13) ─────────────────────────────────────────────────────
# Split by category because the safe-to-spend formula treats them differently:
# investing commitments are money going out, but they are the user's own savings.
COMMITMENTS_NON_INVESTING = {
    "Rent": 22000.00,
    "Maid/Helper": 1000.00,
    "Parents Support": 8000.00,
    "Personal Loan EMI": 8500.00,
    "Gym": 2200.00,
    "Spotify": 119.00,
    "Broadband": 1000.00,
    "Term Insurance": 950.00,
    "Health Insurance": 1400.00,
    "Netflix": 499.00,
    "Electricity (Avg)": 1800.00,
}
COMMITMENTS_INVESTING = {
    "SIP Mutual Fund 1": 10000.00,
    "SIP Mutual Fund 2": 5000.00,
}

# Variable commitments are budgets the user tries to stay within, INSIDE the
# discretionary bucket. The seed is explicit that they do not subtract from
# safe-to-spend, so they must not be subtracted here either.
COMMITMENTS_VARIABLE = {
    "Groceries": 6000.00,
    "Eating out": 5500.00,
    "Transport": 5500.00,
}


@dataclass
class Goal:
    label: str
    target: float
    saved: float
    monthly: float
    target_date: str
    priority: int

    @property
    def remaining(self) -> float:
        return round(self.target - self.saved, 2)

    @property
    def months_at_current_rate(self) -> int:
        return math.ceil(self.remaining / self.monthly) if self.monthly else 0


GOALS = [
    Goal("Phone fund",     35000.00,   8000.00, 4000.00, "2026-08-01", 1),
    Goal("Emergency fund", 300000.00, 184000.00, 2000.00, "2028-01-01", 2),
    Goal("Goa trip",        25000.00,   3000.00, 3000.00, "2026-12-01", 3),
]

WINDFALLS = [
    {"label": "Diwali Bonus", "amount": 50000.00, "status": "pending_allocation"},
    {"label": "Tax Refund",   "amount":  6200.00, "status": "pending_allocation"},
]

# ── labelled purchase history (merchant_stats) ─────────────────────────────────
MERCHANT_STATS = {
    "Myntra": {"labeled": 8, "glad": 1, "regret": 7, "neutral": 0, "regret_rate": 87.50},
    "Amazon": {"labeled": 5, "glad": 3, "regret": 2, "neutral": 0, "regret_rate": 40.00},
    "Zara":   {"labeled": 4, "glad": 2, "regret": 2, "neutral": 0, "regret_rate": 50.00},
    "Swiggy": {"labeled": 1, "glad": 0, "regret": 0, "neutral": 1, "regret_rate": 0.00},
}

# Facts a user might ask for that the seed does not contain. The product must say it
# cannot tell rather than produce a number. This list is the test's definition of
# out-of-scope, so refusal can be scored rather than eyeballed.
ABSENT_FACTS = [
    "credit score",
    "loan principal outstanding",
    "loan interest rate",
    "credit card balance",
    "salary hike date",
]


# ── derived figures ────────────────────────────────────────────────────────────
def non_investing_outflow() -> float:
    """The seed's own comment states this is 47,468 — a check on the transcription."""
    return round(sum(COMMITMENTS_NON_INVESTING.values()), 2)


def investing_outflow() -> float:
    return round(sum(COMMITMENTS_INVESTING.values()), 2)


def total_fixed_commitments() -> float:
    return round(non_investing_outflow() + investing_outflow(), 2)


def total_goal_contributions() -> float:
    return round(sum(g.monthly for g in GOALS), 2)


def safe_to_spend() -> float:
    """Net income, less everything already committed: fixed outgoings, SIPs, and the
    monthly goal contributions. What is left is genuinely discretionary.

    This is the number every affordability answer turns on, and it is the one the
    live endpoint independently reported as 26,532.
    """
    return round(MONTHLY_INCOME_NET
                 - non_investing_outflow()
                 - investing_outflow()
                 - total_goal_contributions(), 2)


def unallocated_windfalls() -> float:
    return round(sum(w["amount"] for w in WINDFALLS
                     if w["status"] == "pending_allocation"), 2)


def committed_share_of_income() -> float:
    return round(100 * (MONTHLY_INCOME_NET - safe_to_spend()) / MONTHLY_INCOME_NET, 1)


def afford(amount: float) -> dict:
    """The deterministic affordability verdict. No model, no judgement call."""
    sts = safe_to_spend()
    return {"amount": round(amount, 2), "safe_to_spend": sts,
            "affordable": amount <= sts,
            "over_by": round(max(0.0, amount - sts), 2)}


def figure_bank() -> dict:
    """Every number the product may put in front of this user, mapped to everything
    that number means. Values collide, and the labels must survive the collision —
    Parents Support and the phone-fund savings are both 8,000, and a bank keyed by
    amount alone would silently drop one meaning."""
    bank: dict = {}

    def add(amt: float, label: str) -> None:
        bank.setdefault(round(amt, 2), []).append(label)

    add(MONTHLY_INCOME_NET, "net monthly income")
    add(MONTHLY_INCOME_GROSS, "gross monthly income")
    add(non_investing_outflow(), "non-investing monthly outflow")
    add(investing_outflow(), "monthly investing (SIPs)")
    add(total_fixed_commitments(), "all fixed commitments")
    add(total_goal_contributions(), "monthly goal contributions")
    add(safe_to_spend(), "safe to spend this month")
    add(unallocated_windfalls(), "windfalls awaiting allocation")
    add(MONTHLY_INCOME_NET - safe_to_spend(), "total already committed")
    # Net income less the fixed commitments, before the goal contributions come out.
    # A correct answer to "how much is committed" may stop at this line rather than
    # going all the way to safe-to-spend, and the arithmetic is sound either way.
    # Leaving it out flagged a correct answer as a fabrication.
    add(MONTHLY_INCOME_NET - total_fixed_commitments(),
        "net income minus fixed commitments, before goal contributions")

    for src in (COMMITMENTS_NON_INVESTING, COMMITMENTS_INVESTING):
        for label, amt in src.items():
            add(amt, f"commitment: {label}")
    for label, amt in COMMITMENTS_VARIABLE.items():
        add(amt, f"variable budget: {label}")
    for g in GOALS:
        add(g.target, f"goal target: {g.label}")
        add(g.saved, f"saved so far towards {g.label}")
        add(g.monthly, f"monthly contribution to {g.label}")
        add(g.remaining, f"still needed for {g.label}")
    for w in WINDFALLS:
        add(w["amount"], f"windfall: {w['label']}")

    return {amt: "; ".join(labels) for amt, labels in bank.items()}


def context_block() -> str:
    """Priya's records as the model sees them in Arm A: raw facts, no pre-computation.
    Every derived total is deliberately withheld, so any total the model states is its
    own arithmetic and can be checked."""
    L = [f"Today's date: {DEMO_TODAY}",
         "User: Priya Sharma, Bangalore. Supporting dependents. Salaried, paid on the 1st.",
         f"Gross monthly income: {MONTHLY_INCOME_GROSS:.2f} INR",
         f"Net monthly income (take-home): {MONTHLY_INCOME_NET:.2f} INR",
         "", "Fixed monthly commitments:"]
    for src in (COMMITMENTS_NON_INVESTING, COMMITMENTS_INVESTING):
        L += [f"  - {k}: {v:.2f} INR" for k, v in src.items()]
    L += ["", "Variable monthly budgets (spending targets, not scheduled debits):"]
    L += [f"  - {k}: {v:.2f} INR" for k, v in COMMITMENTS_VARIABLE.items()]
    L += ["", "Savings goals:"]
    for g in GOALS:
        L.append(f"  - {g.label}: target {g.target:.2f}, saved {g.saved:.2f}, "
                 f"contributing {g.monthly:.2f}/month, due {g.target_date}, "
                 f"priority {g.priority}")
    L += ["", "Windfalls received but not yet allocated:"]
    L += [f"  - {w['label']}: {w['amount']:.2f} INR" for w in WINDFALLS]
    L += ["", "Labelled past purchases (the user rated these afterwards):"]
    for m, s in MERCHANT_STATS.items():
        L.append(f"  - {m}: {s['labeled']} labelled, {s['glad']} glad, "
                 f"{s['regret']} regret, {s['neutral']} neutral")
    return "\n".join(L)


def computed_block() -> str:
    """Arm B's extra input: what the deterministic engine already worked out. In the
    shipped design this is what the model narrates instead of calculating."""
    L = ["PRE-COMPUTED FIGURES (calculated in code from the user's records):"]
    for amt, label in sorted(figure_bank().items(), key=lambda kv: -kv[0]):
        L.append(f"  - {label}: {amt:.2f} INR")
    L.append(f"  - share of take-home already committed: {committed_share_of_income()}%")
    for g in GOALS:
        L.append(f"  - months to finish {g.label} at the current contribution: "
                 f"{g.months_at_current_rate}")
    for m, s in MERCHANT_STATS.items():
        L.append(f"  - {m} regret rate: {s['regret_rate']:.1f}% "
                 f"({s['regret']} of {s['labeled']} labelled)")
    return "\n".join(L)


if __name__ == "__main__":
    print(f"non-investing outflow  {non_investing_outflow():>12,.2f}  (seed says 47,468)")
    print(f"investing (SIPs)       {investing_outflow():>12,.2f}")
    print(f"all fixed commitments  {total_fixed_commitments():>12,.2f}")
    print(f"goal contributions     {total_goal_contributions():>12,.2f}")
    print(f"SAFE TO SPEND          {safe_to_spend():>12,.2f}  (live endpoint says 26,532)")
    print(f"windfalls pending      {unallocated_windfalls():>12,.2f}")
    print(f"committed share        {committed_share_of_income():>11.1f}%")
    for g in GOALS:
        print(f"  {g.label:<16} remaining {g.remaining:>10,.2f}  "
              f"months {g.months_at_current_rate}")
