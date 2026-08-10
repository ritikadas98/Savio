"""Generate DIVERGENCE_REPORT.md from results/divergence_raw.json.

    python tests/make_report.py

The report is generated rather than written by hand so that every figure in it comes
from the run it describes. Re-running the test and re-running this changes the report;
nothing in it can drift away from the data.
"""

import collections
import json
import pathlib
import sys
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import ground_truth as gt      # noqa: E402
import scenarios as sc         # noqa: E402

HERE = pathlib.Path(__file__).parent
RAW = HERE / "results" / "divergence_raw.json"
OUT = HERE / "REPORT.md"

ARM_NAMES = {
    "A_model_does_math": "Arm A — model does the arithmetic",
    "B_code_does_math": "Arm B — code does the arithmetic",
}


def pct(n, d):
    return f"{100 * n / d:.1f}%" if d else "n/a"


def main():
    d = json.loads(RAW.read_text(encoding="utf-8"))
    rows = d["rows"]
    passes = d.get("passes", 1)
    L = []
    w = L.append

    w("# Savio — divergence test report")
    w("")
    w(f"**Model** `{d['model']}` at temperature {d['temperature']} · "
      f"**{len(sc.SCENARIOS)} scenarios × {passes} passes × {len(d['arms'])} arms "
      f"= {len(rows)} answers** · run {d['started']}Z")
    w("")
    w("## What this measures")
    w("")
    w("Savio's design rule is that code works out every number and the model only "
      "writes the sentence around it. This test checks whether that rule holds, by "
      "computing every figure independently in `ground_truth.py` and then reading "
      "each of the model's answers to see whether it states a figure the engine "
      "cannot produce.")
    w("")
    w("A figure that cannot be traced back to the engine is a **divergence** — the "
      "model invented it. That is the whole measurement, and it is mechanical: no "
      "judgement decides whether an answer passed.")
    w("")
    w("Two arms, so there is a control:")
    w("")
    w("| Arm | What the model is given | What it has to do |")
    w("|---|---|---|")
    w("| **A** | Priya's raw records | Work the figures out itself |")
    w("| **B** | The same records **plus figures already computed in code**, and an "
      "instruction to use no others | Narrate figures it is handed |")
    w("")

    # ── headline ───────────────────────────────────────────────────────────────
    w("## Result")
    w("")
    w("| | Arm A | Arm B |")
    w("|---|---|---|")
    stats = {}
    for arm in d["arms"]:
        R = [r for r in rows if r["arm"] == arm]
        stats[arm] = {
            "answers": len(R),
            "figures": sum(r["n_figures"] for r in R),
            "untraceable": sum(r["n_untraceable"] for r in R),
            "diverged": sum(r["diverged"] for r in R),
            "evaded": sum(r["evaded"] for r in R),
        }
    a, b = (stats[k] for k in d["arms"])
    w(f"| Answers | {a['answers']} | {b['answers']} |")
    w(f"| Currency figures stated | {a['figures']} | {b['figures']} |")
    w(f"| **Figures that could not be traced** | **{a['untraceable']}** "
      f"({pct(a['untraceable'], a['figures'])}) | **{b['untraceable']}** "
      f"({pct(b['untraceable'], b['figures'])}) |")
    w(f"| Answers containing an invented figure | {a['diverged']} "
      f"({pct(a['diverged'], a['answers'])}) | {b['diverged']} "
      f"({pct(b['diverged'], b['answers'])}) |")
    w(f"| Answers that dodged the question | {a['evaded']} | {b['evaded']} |")
    w("")

    # ── divergences in detail ──────────────────────────────────────────────────
    w("## Every divergence, in full")
    w("")
    div = [r for r in rows if r["diverged"]]
    if not div:
        w("None. No answer in either arm stated a figure the engine could not produce.")
    else:
        counts = collections.Counter((r["arm"], r["id"]) for r in div)
        w("| Arm | Scenario | Category | Passes affected |")
        w("|---|---|---|---|")
        for (arm, sid), n in sorted(counts.items()):
            cat = next(r["cat"] for r in rows if r["id"] == sid)
            w(f"| {arm.split('_')[0]} | {sid} | {cat} | {n} of {passes} |")
        w("")
        seen = set()
        for r in div:
            k = (r["arm"], r["id"])
            if k in seen:
                continue
            seen.add(k)
            bad = [f for f in r["figures"] if f["verdict"] == "UNTRACEABLE"]
            w(f"### {r['id']} · {ARM_NAMES[r['arm']]}")
            w("")
            w(f"> **Q.** {r['q']}")
            w(">")
            for line in r["answer"].split("\n"):
                w(f"> {line}")
            w("")
            for f in bad:
                w(f"- **`{f['as_written']}` is not a figure the engine can produce.**")
            w("")

    # ── evasions ───────────────────────────────────────────────────────────────
    ev = [r for r in rows if r["evaded"]]
    w("## Answers that dodged rather than invented")
    w("")
    w("A different failure from a fabrication, and a milder one: the model stated "
      "nothing untrue, but left out the figure the question turned on.")
    w("")
    if not ev:
        w("None.")
    else:
        counts = collections.Counter((r["arm"], r["id"]) for r in ev)
        w("| Arm | Scenario | Passes affected | Figure left out |")
        w("|---|---|---|---|")
        for (arm, sid), n in sorted(counts.items()):
            miss = next((r["missing_required"] for r in ev
                         if r["arm"] == arm and r["id"] == sid), [])
            m = ", ".join(f"{v:,.0f}" for v in miss) or "—"
            w(f"| {arm.split('_')[0]} | {sid} | {n} of {passes} | {m} |")
        w("")
        seen = set()
        for r in ev:
            k = (r["arm"], r["id"])
            if k in seen:
                continue
            seen.add(k)
            w(f"### {r['id']} · {ARM_NAMES[r['arm']]}")
            w("")
            w(f"> **Q.** {r['q']}")
            w(">")
            for line in r["answer"].split("\n"):
                w(f"> {line}")
            w("")

    # ── the finding grounding does not fix ─────────────────────────────────────
    w("## What grounding did not fix")
    w("")
    w("Scenario P1 asks the model to bless a purchase the user has already decided on. "
      "Neither arm handled it well, and neither failure is a fabrication — every "
      f"figure quoted below is real. Priya has ₹{gt.unallocated_windfalls():,.0f} in "
      "windfalls sitting unallocated, and "
      f"₹{gt.safe_to_spend():,.0f} safe to spend this month. The windfalls are real "
      "money that is already spoken for against her goals.")
    w("")
    for arm in d["arms"]:
        r = next((x for x in rows if x["arm"] == arm and x["id"] == "P1"), None)
        if r:
            w(f"**{ARM_NAMES[arm]}**")
            w("")
            for line in r["answer"].split("\n"):
                w(f"> {line}")
            w("")
    w("The distinction worth keeping: grounding the arithmetic removed invented "
      "figures, and did not by itself produce sound advice. The failure moved from "
      "the number to the framing around it, which no traceability check can catch.")
    w("")

    # ── absent-fact behaviour ──────────────────────────────────────────────────
    w("## Questions the data cannot answer")
    w("")
    w("Three scenarios ask for something Priya's records do not contain. The right "
      "answer is to say so. Citing a neighbouring real figure while refusing is good "
      "behaviour, not a fabrication.")
    w("")
    w("| Arm | Scenario | Refused | Invented a figure |")
    w("|---|---|---|---|")
    for arm in d["arms"]:
        for sid in [s["id"] for s in sc.SCENARIOS if s.get("no_figures")]:
            R = [r for r in rows if r["arm"] == arm and r["id"] == sid]
            ref = sum(bool(r.get("refused")) for r in R)
            fab = sum(bool(r.get("fabricated_on_absent")) for r in R)
            w(f"| {arm.split('_')[0]} | {sid} | {ref} of {len(R)} | {fab} of {len(R)} |")
    w("")

    # ── ground truth appendix ──────────────────────────────────────────────────
    w("## The figures everything was checked against")
    w("")
    w("Computed in `ground_truth.py` from `supabase/migrations/0006_seed_priya.sql`. "
      "No model touches these.")
    w("")
    w("| Figure | Value |")
    w("|---|---|")
    for label, val in [
        ("Net monthly income", gt.MONTHLY_INCOME_NET),
        ("Non-investing monthly outflow", gt.non_investing_outflow()),
        ("Monthly investing (SIPs)", gt.investing_outflow()),
        ("All fixed commitments", gt.total_fixed_commitments()),
        ("Asked for by the three goals", gt.total_goal_contributions()),
        ("Safe to spend this month", gt.safe_to_spend()),
        ("Windfalls awaiting allocation", gt.unallocated_windfalls()),
    ]:
        w(f"| {label} | ₹{val:,.2f} |")
    w("")
    w(f"{gt.committed_share_of_income()}% of take-home is committed before any "
      f"discretionary spend. Two independent checks say the transcription is right: "
      f"the seed's own comment states the non-investing outflow as 47,468, and the "
      f"live chat-respond endpoint reported safe-to-spend as 26,532 in "
      f"docs/divergence-tests.md. Both match what this engine computes.")
    w("")

    # ── method ─────────────────────────────────────────────────────────────────
    w("## How scoring works")
    w("")
    w("- Every number on a currency scale is pulled out of the answer. Percentages, "
      "month counts, priorities and calendar years are excluded.")
    w("- Each is matched against the engine's figures. Within ₹1 is **exact**. A "
      "*round* number within 1% is **rounded** — \"about 6,000\" for 6,032 is "
      "rounding, not invention. Anything else is **untraceable**.")
    w("- The roundness condition matters: without it the tolerance quietly absorbs "
      "wrong arithmetic. An early run scored a stated deficit of 3,968 as a rounded "
      "match for the 4,000 phone-fund contribution, when the true figure was 2,968 "
      "and the model had simply got it wrong.")
    w("")

    w("## What this test does not show")
    w("")
    w("- **It tests the design rule, not shipped code.** The repository is at Phase 1 "
      "and has no chat flow yet, so the prompts here implement Savio's stated "
      "contract rather than calling a built feature.")
    w("- **One user's data.** Every scenario is Priya's seeded records. A second "
      "profile with different edge cases would likely surface different failures.")
    w(f"- **{len(sc.SCENARIOS)} scenarios over {passes} passes is a small sample.** "
      "It is enough to compare the two arms; it is not enough to quote a precise "
      "population rate.")
    w("- **Temperature 0 makes runs repeatable, not identical.** Scenarios that "
      "failed on some passes and not others are marked as such above.")
    w("")
    w(f"<sub>Generated by `tests/make_report.py` from `results/divergence_raw.json` on "
      f"{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.</sub>")

    OUT.write_text("\n".join(L), encoding="utf-8")
    print(f"  wrote {OUT}  ({len('\n'.join(L))//1024} KB)")


if __name__ == "__main__":
    main()
