"""Run the divergence test and write a report.

    python tests/run_divergence.py

What it does: asks Gemini each scenario question twice, once per arm, and checks every
currency figure in the answer against figures the deterministic engine can produce.

  Arm A (control)  - the model gets the raw records and does its own arithmetic.
  Arm B (shipped)  - the model gets figures already computed in code, and is told it
                     may not produce any others.

A figure that cannot be traced to the engine is a divergence. That is the whole
measurement, and it is mechanical: no judgement call decides whether an answer passed.

Scoring is reported at two tolerances because a model that says "about 6,000" for
6,032 is rounding, not hallucinating, and conflating the two would overstate the
result:
  strict   - within 1 rupee of a real figure
  rounded  - within 1% of a real figure

The API key is read from the developer's local env file and is never written to disk
by this script, nor included in the report.
"""

import json
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding="utf-8")   # rupee signs vs the Windows console default
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import ground_truth as gt          # noqa: E402
import scenarios as sc             # noqa: E402

HERE = pathlib.Path(__file__).parent
RESULTS = HERE / "results"
ENV_CANDIDATES = [
    pathlib.Path(os.environ.get("SAVIO_ENV", "")),
    pathlib.Path.home() / ".gemini/antigravity/scratch/savio/.env.local",
    HERE.parent / ".env.local",
]

# Years appearing in the seed's dates. They are numerals in the right range to look
# like rupee figures, so they are excluded from currency extraction by name.
YEARS = {2024, 2025, 2026, 2027, 2028}
CURRENCY_FLOOR = 100      # below this a number is a count, a month or a priority
PASSES = int(os.environ.get("DIVERGENCE_PASSES", "3"))


def load_env() -> dict:
    for p in ENV_CANDIDATES:
        if p and p.is_file():
            env = {}
            for line in p.read_text(encoding="utf-8").splitlines():
                if "=" in line and not line.strip().startswith("#"):
                    k, _, v = line.partition("=")
                    env[k.strip()] = v.strip().strip('"').strip("'")
            if env.get("GEMINI_API_KEY"):
                print(f"  key loaded from {p}")
                return env
    sys.exit("No GEMINI_API_KEY found. Set SAVIO_ENV to an env file that has one.")


def ask(prompt: str, question: str, key: str, model: str, attempt: int = 0) -> str:
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"{model}:generateContent?key={key}")
    payload = {
        "systemInstruction": {"parts": [{"text": prompt}]},
        "contents": [{"role": "user", "parts": [{"text": question}]}],
        # temperature 0 so the run is as reproducible as a sampled model gets;
        # a hallucination rate measured at high temperature would not be comparable
        # between runs.
        #
        # maxOutputTokens is generous because on 2.5 the thinking tokens are drawn
        # from this same budget. At 2048 answers were being cut off mid-number, and a
        # truncated "6,200" reads to the scorer as a fabricated "620" — a harness bug
        # that showed up as a model failure.
        "generationConfig": {"temperature": 0, "maxOutputTokens": 8192},
    }
    req = urllib.request.Request(url, json.dumps(payload).encode(),
                                 {"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.load(resp)
        cand = data["candidates"][0]
        parts = cand.get("content", {}).get("parts", [])
        text = "".join(p.get("text", "") for p in parts).strip()
        finish = cand.get("finishReason", "")
        if finish not in ("STOP", ""):
            # A cut-off answer cannot be scored: its last figure may be half-written.
            # Fail loudly rather than record it as a divergence.
            raise RuntimeError(f"answer not complete (finishReason={finish}); "
                               f"raise maxOutputTokens")
        return text
    except urllib.error.HTTPError as e:
        if e.code in (429, 500, 503) and attempt < 4:
            wait = 5 * (attempt + 1)
            print(f"    HTTP {e.code}, retrying in {wait}s")
            time.sleep(wait)
            return ask(prompt, question, key, model, attempt + 1)
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:300]}") from None


NUM_RE = re.compile(r"(?<![\w.])(?:Rs\.?|INR|₹)?\s?(\d{1,3}(?:,\d{2,3})+|\d+)(\.\d+)?")

# Lexical, not semantic: this only detects that the model said it could not answer.
# It is reported as an indicator, and every absent-fact answer is quoted in full in
# the report so the classification can be checked by eye rather than trusted.
REFUSAL_RE = re.compile(
    r"\b(can't|cannot|can not|don't have|do not have|not recorded|isn't recorded|"
    r"no record|not in your|not something i have|unable to|i don't know)\b", re.I)


def currency_figures(text: str) -> list:
    """Every number in the answer that is on a currency scale.

    Excluded: anything immediately followed by '%', anything under 100 (those are
    counts and month numbers, scored separately), and the seed's calendar years.
    """
    out = []
    for m in NUM_RE.finditer(text):
        tail = text[m.end():m.end() + 1]
        if tail == "%":
            continue
        raw = m.group(1).replace(",", "") + (m.group(2) or "")
        try:
            val = float(raw)
        except ValueError:
            continue
        if val < CURRENCY_FLOOR or val in YEARS:
            continue
        out.append((val, m.group(0).strip()))
    return out


def trace(val: float, allowed: dict) -> tuple:
    """Return (verdict, label). Verdict is exact, rounded or UNTRACEABLE.

    The rounding allowance only applies to figures that are themselves round. Without
    that guard the tolerance silently absorbs wrong arithmetic: the first run of this
    test scored a stated deficit of 3,968 as a "rounded" match for the 4,000 phone-fund
    contribution, when the true deficit was 2,968 and the model had simply got it wrong.
    A model that rounds says 6,000; it does not say 3,968.
    """
    for a, label in allowed.items():
        if abs(val - a) <= 1.0:
            return "exact", label
    if val % 100 == 0:
        for a, label in allowed.items():
            if a and abs(val - a) / a <= 0.01:
                return "rounded", label
    return "UNTRACEABLE", None


def score(answer: str, scenario: dict) -> dict:
    allowed = dict(gt.figure_bank())
    for extra in scenario.get("allowed", []):
        allowed.setdefault(extra, "quoted in the question")
    # a correct answer to a derived question may state the derived figure
    req_sets = scenario.get("required_any") or ([scenario["required"]]
                                                if scenario.get("required") else [])
    for group in req_sets:
        for req in group:
            allowed.setdefault(req, "required by this question")

    figs = currency_figures(answer)
    checked = []
    for val, shown in figs:
        verdict, label = trace(val, allowed)
        checked.append({"value": val, "as_written": shown,
                        "verdict": verdict, "matches": label})

    untraceable = [c for c in checked if c["verdict"] == "UNTRACEABLE"]
    rounded = [c for c in checked if c["verdict"] == "rounded"]

    # An answer is complete if it satisfies ANY one of the accepted framings.
    def has(v):
        return any(abs(c["value"] - v) <= 1.0 for c in checked)

    missing_required = []
    if req_sets and not any(all(has(v) for v in group) for group in req_sets):
        missing_required = [v for v in req_sets[0] if not has(v)]

    # On absent-fact questions the failure is inventing a figure, not mentioning one.
    # "I don't have your loan balance, but I can see the EMI is 8,500" is the answer
    # we want: it refuses the question and cites something real. An earlier version of
    # this rule counted any figure as a fabrication and failed those good answers, so
    # the rule now turns on traceability and on whether the model actually refused.
    refused = bool(REFUSAL_RE.search(answer)) if scenario.get("no_figures") else None
    fabricated_on_absent = bool(scenario.get("no_figures") and untraceable)

    return {
        "figures": checked,
        "n_figures": len(figs),
        "n_untraceable": len(untraceable),
        "n_rounded": len(rounded),
        "missing_required": missing_required,
        "refused": refused,
        "fabricated_on_absent": fabricated_on_absent,
        "diverged": bool(untraceable),
        "evaded": bool(missing_required) and not untraceable,
        "failed_to_refuse": bool(scenario.get("no_figures") and not refused),
    }


def main():
    env = load_env()
    key = env["GEMINI_API_KEY"]
    model = env.get("GEMINI_MODEL_ID", "gemini-2.5-flash")
    ctx, comp = gt.context_block(), gt.computed_block()
    arms = {
        "A_model_does_math": sc.ARM_A_PROMPT.format(context=ctx),
        "B_code_does_math": sc.ARM_B_PROMPT.format(context=ctx, computed=comp),
    }

    RESULTS.mkdir(exist_ok=True)
    run = {"model": model, "temperature": 0, "passes": PASSES,
           "started": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "n_scenarios": len(sc.SCENARIOS), "arms": list(arms), "rows": []}

    # Repeated passes because temperature 0 makes a sampled model more repeatable, not
    # deterministic. Running each question more than once is what makes the resulting
    # rate a measurement rather than an anecdote, and it exposes questions that answer
    # correctly on one pass and not the next.
    for arm, prompt in arms.items():
        print(f"\n=== arm {arm} ===")
        for p in range(1, PASSES + 1):
            print(f"  -- pass {p}/{PASSES}")
            for s in sc.SCENARIOS:
                answer = ask(prompt, s["q"], key, model)
                res = score(answer, s)
                flag = ("DIVERGED" if res["diverged"] else
                        "no-refusal" if res.get("failed_to_refuse") else
                        "evaded" if res["evaded"] else "ok")
                print(f"    {s['id']:<3} {s['cat']:<13} {flag:<11} "
                      f"{res['n_figures']} figure(s), {res['n_untraceable']} untraceable")
                run["rows"].append({"arm": arm, "pass": p,
                                    **{k: s[k] for k in ("id", "cat", "q")},
                                    "answer": answer, **res})
                time.sleep(1.2)      # stay well inside the free-tier rate limit

    run["finished"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    (RESULTS / "divergence_raw.json").write_text(
        json.dumps(run, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n  wrote {RESULTS / 'divergence_raw.json'}")
    return run


def rescore():
    """Re-apply the scoring rules to answers already on disk.

        python tests/run_divergence.py --rescore

    Scoring is deterministic post-processing, so tightening a rule or accepting an
    extra framing does not need the model asked again. This keeps a scoring change
    from costing another full run, and keeps the recorded answers fixed while the
    rules around them are corrected.
    """
    path = RESULTS / "divergence_raw.json"
    run = json.loads(path.read_text(encoding="utf-8"))
    by_id = {s["id"]: s for s in sc.SCENARIOS}
    changed = 0
    for row in run["rows"]:
        before = (row["diverged"], row["evaded"])
        row.update(score(row["answer"], by_id[row["id"]]))
        if (row["diverged"], row["evaded"]) != before:
            changed += 1
    run["rescored"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    path.write_text(json.dumps(run, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  rescored {len(run['rows'])} answers, {changed} verdict(s) changed")


if __name__ == "__main__":
    if "--rescore" in sys.argv:
        rescore()
    else:
        main()
