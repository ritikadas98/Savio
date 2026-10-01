"""The answer key: what a correct reply to each question must say.

Reads Priya's records from the live database (the same rows the chat function reads)
and works out every figure and verdict here, in Python, with no model involved. This is
a second implementation of the product rules, written from the rules themselves, not
translated from the TypeScript. A test that grades the app with the app's own maths
would prove nothing.

The product rules, as Savio states them to the user:
  safe-to-spend = net income - fixed commitments (incl. SIPs) - goal contributions
  cushion       = savings above the safety net (unearmarked cash, less any shortfall
                  of the fund that backs the safety net)
  GREEN   price fits safe-to-spend, is at or under the impulse-wait threshold, and
          leaves the daily budget at or above the daily floor
  YELLOW  price fits safe-to-spend but crosses the impulse-wait threshold or the daily
          floor, OR price is over safe-to-spend but the cushion covers the difference
  RED     price is over safe-to-spend and there is no cushion, OR it is over
          safe-to-spend plus cushion (it would cut into the safety net)
"""

import calendar
import json
import math
import re
import pathlib
import urllib.request
from datetime import datetime, timedelta, timezone

ROOT = pathlib.Path(__file__).resolve().parents[2]
RANK = {"GREEN": 0, "YELLOW": 1, "RED": 2}       # higher = more cautious
GOAL_STOP = {"fund", "trip", "goal", "savings", "saving", "the", "for", "new", "and"}


def load_env() -> dict:
    env = {}
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


class Api:
    """Talks to Supabase as Priya, through the same public API the app uses."""

    def __init__(self):
        env = load_env()
        self.url, self.anon = env["VITE_SUPABASE_URL"], env["VITE_SUPABASE_ANON_KEY"]
        self.password = env["DEMO_PRIYA_PASSWORD"]
        self.login()

    def login(self):
        self.token = self.call("POST", "/auth/v1/token?grant_type=password",
                               {"email": "priya@savio.demo", "password": self.password},
                               auth=False)["access_token"]

    def call(self, method, path, body=None, auth=True, timeout=120):
        headers = {"apikey": self.anon, "Content-Type": "application/json",
                   "Authorization": f"Bearer {self.token if auth else self.anon}",
                   "Prefer": "return=representation"}
        req = urllib.request.Request(self.url + path,
                                     json.dumps(body).encode() if body is not None else None,
                                     headers, method=method)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
        return json.loads(raw) if raw else None

    def rows(self, table, select="*"):
        return self.call("GET", f"/rest/v1/{table}?select={select}")


def snapshot(api: Api) -> dict:
    """Every row the chat function reads to answer a question."""
    return {
        "profile": api.rows("profiles")[0],
        "goals": api.rows("goals"),
        "commitments": api.rows("commitments", "label,amount,category,kind"),
        "rituals": api.rows("monthly_rituals", "month_year,status,safe_to_spend_locked"),
        "rollovers": api.rows("rollover_allocations", "ritual_month,destination_kind,total_amount"),
        "merchants": api.rows("merchant_stats", "merchant,total_labeled,regret_count,regret_rate"),
        "windfalls": api.rows("windfalls", "amount,status"),
    }


def days_left_in_month() -> int:
    """Savio pins 'today' to the 1st of the current month in India time, so the days
    left are the whole month, counting today."""
    ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    return calendar.monthrange(ist.year, ist.month)[1]


class Key:
    def __init__(self, snap: dict):
        p = snap["profile"]
        self.snap = snap
        self.income = float(p["monthly_income_net"])
        self.gross = float(p["monthly_income_gross"] or 0)
        self.safety_net = float(p["safety_net"])
        self.impulse = float(p["impulse_wait_threshold"])
        self.impulse_hours = int(p["impulse_wait_hours"])
        self.daily_floor = float(p["daily_sps_floor"])
        self.liquid = float(p["unearmarked_liquid"])

        fixed = [c for c in snap["commitments"] if (c["kind"] or "fixed") != "variable"]
        investing = lambda c: (c["category"] or "").lower() in ("investing", "investment")
        self.non_investing = sum(float(c["amount"]) for c in fixed if not investing(c))
        self.investing = sum(float(c["amount"]) for c in fixed if investing(c))
        self.goals = [g for g in snap["goals"] if g["status"] == "active"]
        self.goal_contrib = sum(float(g["monthly_contribution"] or 0) for g in self.goals)
        self.sts = self.income - self.non_investing - self.investing - self.goal_contrib
        # Monthly budgets (groceries, eating out, transport) sit inside safe-to-spend.
        self.budgets = sum(float(c["amount"]) for c in snap["commitments"] if c["kind"] == "variable")
        self.pending = sum(float(w["amount"]) for w in snap["windfalls"] if w["status"] == "pending_allocation")

        backer = next((g for g in snap["goals"] if g.get("backs_safety_net")), None)
        backer_bal = float(backer["current_amount"]) if backer else 0.0
        self.cushion = max(0.0, self.liquid - max(0.0, self.safety_net - backer_bal))
        self.backer_bal = backer_bal
        self.days = days_left_in_month()
        self.daily = self.sts / self.days

    # ── the verdict ────────────────────────────────────────────────────────────
    def verdict(self, price: float) -> str:
        if price <= self.sts:
            daily_after = (self.sts - price) / self.days
            if price > self.impulse or daily_after < self.daily_floor:
                return "YELLOW"
            return "GREEN"
        if self.cushion <= 0 or price > self.sts + self.cushion:
            return "RED"
        return "YELLOW"

    # ── facts from her records a good answer must use ──────────────────────────
    def required_facts(self, price: float, chat_text: str) -> list:
        """What fits Priya: what is free after her monthly budgets (in-budget spends),
        the savings in a goal that matches what she asks about, and her unassigned
        windfalls when the spend leaves less than her monthly budgets."""
        out = []
        if price <= self.sts:
            out.append((abs(round(self.sts - price - self.budgets, 2)), "free or short after monthly budgets"))
        t = chat_text.lower()
        for g in self.snap["goals"]:
            if g["status"] != "active" or g.get("backs_safety_net"):
                continue
            words = [w for w in re.split(r"[^a-z]+", g["label"].lower()) if len(w) > 2 and w not in GOAL_STOP]
            if any(re.search(rf"\b{w}\b", t) for w in words):
                out.append((float(g["current_amount"]), f"saved in {g['label']}"))
        if self.sts - price < self.budgets and self.pending > 0:
            out.append((self.pending, "windfalls not yet assigned"))
        return out

    def fund_after(self, price: float) -> float:
        return self.backer_bal - max(0.0, price - self.sts - self.cushion)

    # ── figures a truthful answer may state ────────────────────────────────────
    def figure_bank(self) -> dict:
        bank: dict = {}

        def add(v, label):
            bank.setdefault(round(float(v), 2), []).append(label)

        add(self.income, "net monthly income")
        add(self.gross, "gross monthly income")
        add(self.non_investing, "fixed commitments, not investing")
        add(self.investing, "monthly SIPs")
        add(self.non_investing + self.investing, "all fixed commitments")
        add(self.goal_contrib, "monthly goal contributions")
        add(self.sts, "safe-to-spend this month")
        add(self.income - self.sts, "already committed this month")
        add(self.income - self.non_investing - self.investing, "income after fixed commitments")
        add(round(self.daily), "daily safe-to-spend")
        add(self.safety_net, "safety net rule")
        add(self.impulse, "impulse-wait threshold")
        add(self.daily_floor, "daily floor rule")
        add(self.liquid, "unearmarked savings")
        add(self.cushion, "cushion above the safety net")
        add(self.backer_bal, "balance of the fund backing the safety net")
        add(self.sts + self.cushion, "safe-to-spend plus cushion")
        add(self.sts - self.budgets, "free each month after the monthly budgets")
        add(self.investing + self.goal_contrib, "saved each month (SIPs + goals)")
        add(self.backer_bal - self.safety_net + self.liquid, "all savings above the safety net")
        by_cat: dict = {}
        for c in self.snap["commitments"]:
            by_cat.setdefault((c["category"] or "", c["kind"]), []).append(float(c["amount"]))
        for (cat, _), amts in by_cat.items():
            if len(amts) > 1:
                add(sum(amts), f"{cat} commitments together")
        for c in self.snap["commitments"]:
            add(c["amount"], f"commitment: {c['label']}")
        variable = [c for c in self.snap["commitments"] if c["kind"] == "variable"]
        if variable:
            add(sum(float(c["amount"]) for c in variable), "variable budgets together")
        for g in self.snap["goals"]:
            add(g["target_amount"], f"target of {g['label']}")
            add(g["current_amount"], f"saved towards {g['label']}")
            add(g["monthly_contribution"], f"monthly to {g['label']}")
            add(float(g["target_amount"]) - float(g["current_amount"]), f"still needed for {g['label']}")
        pending = [float(w["amount"]) for w in self.snap["windfalls"] if w["status"] == "pending_allocation"]
        for w in pending:
            add(w, "pending windfall")
        if pending:
            add(sum(pending), "pending windfalls together")
        return {v: "; ".join(ls) for v, ls in bank.items()}

    def price_figures(self, price: float) -> dict:
        """Figures that follow from a price the user named."""
        out = {price: "price in the question"}
        left = self.sts - price
        out[abs(round(left - self.budgets, 2))] = "free (or short) after the monthly budgets"
        if self.sts > self.budgets:
            out[math.ceil(price / (self.sts - self.budgets))] = "months of saving what is free"
        out[abs(round(left / self.days))] = "daily budget after the purchase"
        out[abs(round(self.daily - left / self.days))] = "drop in daily budget"
        if price <= self.sts:
            out[round(left, 2)] = "safe-to-spend left after the purchase"
        else:
            over = price - self.sts
            out[round(over, 2)] = "amount over safe-to-spend"
            out[round(self.cushion - over, 2)] = "cushion left after the purchase"
            out[round(price - self.sts - self.cushion, 2)] = "amount past safe-to-spend plus cushion"
            out[math.ceil(over / self.sts)] = "months to rebuild"
            into_floor = price - self.sts - self.cushion
            if into_floor > 0:      # cuts into the safety net: what is left of it
                out[round(self.backer_bal - into_floor, 2)] = "safety-net fund after the purchase"
                out[round(self.safety_net - into_floor, 2)] = "safety net after the purchase"
                left = self.backer_bal - into_floor
                if left < self.safety_net:
                    out[round(self.safety_net - left, 2)] = "shortfall below the safety net"
            out[round(self.sts + self.cushion + self.backer_bal, 2)] = "safe-to-spend + cushion + safety-net fund"
        return out


if __name__ == "__main__":
    k = Key(snapshot(Api()))
    print(f"safe-to-spend {k.sts:,.0f} | cushion {k.cushion:,.0f} | days {k.days} | "
          f"daily {k.daily:,.0f} | impulse {k.impulse:,.0f}")
    for p in (500, 3000, 3001, 5000, 8000, 26532, 26533, 50000, 76532, 76533, 108000):
        print(f"  {p:>8,} -> {k.verdict(p)}")
