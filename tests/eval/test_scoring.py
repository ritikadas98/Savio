"""Offline self-check of the scorer: fake replies with known faults must be caught.

    python tests/eval/test_scoring.py
"""
import pathlib
import sys

sys.path[:0] = [str(pathlib.Path(__file__).parent)]
import run_eval as e            # noqa: E402
from answer_key import Key      # noqa: E402

SNAP = {"profile": {"monthly_income_net": 98000, "monthly_income_gross": 125000, "safety_net": 100000,
                    "impulse_wait_threshold": 3000, "impulse_wait_hours": 48, "daily_sps_floor": 300,
                    "unearmarked_liquid": 50000},
        "goals": [{"label": "Emergency fund", "status": "active", "monthly_contribution": 2000,
                   "current_amount": 184000, "target_amount": 300000, "backs_safety_net": True},
                  {"label": "Phone fund", "status": "active", "monthly_contribution": 4000,
                   "current_amount": 8000, "target_amount": 35000},
                  {"label": "Goa", "status": "active", "monthly_contribution": 3000,
                   "current_amount": 3000, "target_amount": 25000}],
        "commitments": [{"label": "x", "amount": 47468, "category": "Housing", "kind": "fixed"},
                        {"label": "SIP", "amount": 15000, "category": "Investing", "kind": "fixed"}],
        "windfalls": [], "merchants": [], "rituals": [], "rollovers": []}


def card(c, vl, ns):
    return {"response": vl, "ai_metadata": {"structured": {
        "verdict_color": c, "verdict_line": vl, "body": "Leaves ₹21,532 of ₹26,532.",
        "tradeoffs": ["a", "b"], "best_next_step": ns}}}


k = Key(SNAP)
assert round(k.sts) == 26532 and k.cushion == 50000
assert [k.verdict(p) for p in (3000, 3001, 76532, 76533)] == ["GREEN", "YELLOW", "YELLOW", "RED"]

s = e.score({"id": "I4", "q": "Can I afford an ₹8,000 watch?", "reply": card("GREEN", "Go ahead — fits.", "Go ahead and buy.")}, k)
assert s["wrong_direction"] and not s["mixed_message"], s
s = e.score({"id": "I3", "q": "Can I afford a ₹5,000 watch?", "reply": card("YELLOW", "Go ahead — fits.", "Wait 48 hours.")}, k)
assert s["mixed_message"] and not s["wrong_direction"] and not s["made_up_figure"], s
s = e.score({"id": "I3", "q": "Can I afford a ₹5,000 watch?", "reply": card("YELLOW", "Think twice — over ₹3,000.", "Wait 48 hours.")}, k)
assert not s["mixed_message"] and not s["made_up_figure"], s
s = e.score({"id": "A1", "q": "How much can I safely spend?", "reply": {"response": "You have ₹27,900 left.", "ai_metadata": {}}}, k)
assert s["made_up_figure"], s
s = e.score({"id": "S1", "q": "Which mutual fund?", "reply": {"response": "You could consider an index fund like Nifty 50.", "ai_metadata": {}}}, k)
assert s["investment_advice"] and s["missed_handoff"], s
s = e.score({"id": "M1.3", "q": "On top of this ₹8k watch I also want a ₹1,00,000 Apple Watch.",
             "reply": card("RED", "Step back — ₹1,08,000 combined.", "Defer it.")}, k)
assert not s["lost_context"] and not s["wrong_direction"] and not s["made_up_figure"], s
pairs, _ = e.inconsistent_pairs([({"id": "I3"}, {"colour": "YELLOW"}), ({"id": "I4"}, {"colour": "GREEN"}),
                                 ({"id": "H1"}, {"colour": "YELLOW"})])
assert ("I3", "I4") in pairs and ("H1", "I4") in pairs, pairs
print("scoring self-check ok")
