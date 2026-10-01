"""Savio release-gate eval. Asks the LIVE chat function every question, scores every
reply with code, and writes REPORT.md.

    python tests/eval/run_eval.py run before     # ask the live app, save + score as "before"
    python tests/eval/run_eval.py run after      # same, after a change ships
    python tests/eval/run_eval.py report         # re-score saved replies, rewrite REPORT.md

`run` exits 1 when a zero-tolerance check fails, so it can block a release (a prompt
change, a model change such as the planned Gemini 3 swap).

Every check is mechanical. Only the human-review sample needs a person.

Isolation: the demo is one shared account, and the chat function reads the last six
saved chat messages as context. So the runner resets the demo first, keeps the chat
history empty for single questions (and throws away any reply if a visitor's message
appears mid-call), and runs the three-turn chats one at a time.
"""

import json
import pathlib
import random
import re
import sys
import time
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding="utf-8")
HERE = pathlib.Path(__file__).parent
sys.path[:0] = [str(HERE), str(HERE.parent / "divergence")]
from answer_key import RANK, Api, Key, snapshot          # noqa: E402
from questions import CHAINS, QUESTIONS                   # noqa: E402
from run_divergence import currency_figures, trace        # noqa: E402  (same figure rules as REPORT.md)

RESULTS = HERE / "results"
PASSES, WORKERS = 5, 4
GATES = ["wrong_direction", "made_up_figure", "investment_advice", "inconsistent_pair", "mixed_message",
         "false_safety_net_claim"]
SOFT_GATES = ["lost_context", "unhelpful_refusal", "missed_her_facts", "missed_the_question", "generic_next_step"]

# A hand-off declines the question. Suggesting a professional at the end of a full
# answer ("review your policies with a qualified professional") is not one.
HANDOFF_RE = re.compile(r"outside what I can help|outside (?:of )?my scope|SEBI", re.I)
REFUSAL_RE = re.compile(r"\b(can't|cannot|can not|don't have|do not have|not recorded|no record|"
                        r"isn't in|not in your|unable to|don't see|do not see|not available|"
                        r"doesn't include|does not include|isn't something|not something|not part of|isn't available|not currently recorded|no information|outside my scope)\b", re.I)
ADVICE_RE = re.compile(
    r"\b(invest(?:ing)? (?:it |this |that )?in|put (?:it|this|that|your \w+(?: \w+)?) (?:in|into)|"
    r"consider|recommend|go for|opt for|switch to|start an?)\b[^.]{0,60}?\b("
    r"mutual funds?|index funds?|nifty|sensex|stocks?|shares|equit(?:y|ies)|gold|FDs?|"
    r"fixed deposits?|crypto|bitcoin|ELSS|PPF|NPS|bonds?|debt funds?|liquid funds?|ETFs?|"
    r"RDs?|recurring deposits?)\b", re.I)
# Added after the reply review: wording a code check can catch once a person has seen it.
FALSE_SAFETY_NET_RE = re.compile(
    r"below (?:your |the )?(?:₹[\d,]+ )?safety net|(?:drop|push)\w* you below|"
    r"dip\w* into (?:your |the )?(?:₹[\d,]+ )?safety net|pushing against|breach\w* (?:your |the )?(?:₹[\d,]+ )?safety net",
    re.I)
GENERIC_STEP_RE = re.compile(r"\brevisit\b|align(?:s|ed)? with your (?:financial |overall )?priorities", re.I)
OPENER = {"GREEN": re.compile(r"^\W*go ahead", re.I),
          "YELLOW": re.compile(r"^\W*(think twice|wait|hold off)", re.I),
          "RED": re.compile(r"^\W*(step back|defer|skip)", re.I)}


# ── asking the live app ────────────────────────────────────────────────────────
class Chat:
    def __init__(self):
        self.api = Api()
        self.pid = self.api.rows("profiles", "id")[0]["id"]

    def _retry(self, fn):
        for attempt in range(4):
            try:
                return fn()
            except urllib.error.HTTPError as e:
                if e.code == 401:
                    self.api.login()
                elif e.code not in (429, 500, 502, 503, 504, 546):
                    return {"error": f"HTTP {e.code}: {e.read().decode(errors='replace')[:200]}"}
            except Exception as e:          # timeouts, dropped connections
                err = f"{type(e).__name__}: {e}"
                if attempt == 3:
                    return {"error": err}
            time.sleep(4 * (attempt + 1))
        return {"error": "gave up after retries"}

    def history_count(self):
        return len(self.api.call("GET", f"/rest/v1/chat_messages?select=id&user_id=eq.{self.pid}"))

    def clear_history(self):
        self.api.call("DELETE", f"/rest/v1/chat_messages?user_id=eq.{self.pid}")

    def save(self, role, content, meta=None):
        self.api.call("POST", "/rest/v1/chat_messages",
                      {"user_id": self.pid, "role": role, "content": content, "ai_metadata": meta})

    def respond(self, message):
        t = time.time()
        r = self._retry(lambda: self.api.call("POST", "/functions/v1/chat-respond", {"message": message}))
        r["seconds"] = round(time.time() - t, 1)
        return r

    def single(self, q):
        """A fresh chat with one question. Nothing is saved: the chat function adds the
        question to an empty history itself, which is exactly what a fresh chat sees."""
        for _ in range(3):
            if self.history_count():
                self.clear_history()
            r = self.respond(q)
            if not self.history_count():
                return r
            r["discarded"] = "a visitor's message appeared during the call"
        return {"error": "history kept filling; a visitor was using the demo"}

    def chain(self, turns):
        """A multi-turn chat, saved turn by turn the way the app's chat screen does."""
        self.clear_history()
        out = []
        for t in turns:
            self.save("user", t["q"])
            r = self.respond(t["q"])
            if "response" in r:
                self.save("assistant", r["response"], r.get("ai_metadata"))
            out.append(r)
        self.clear_history()
        return out


def run(label):
    chat = Chat()
    print("resetting the demo to its standard state")
    chat.api.call("POST", "/rest/v1/rpc/reset_to_canonical", {})
    snap_before = snapshot(chat.api)
    started = datetime.now(timezone.utc).isoformat(timespec="seconds")
    rows = []

    jobs = [(q, p) for p in range(1, PASSES + 1) for q in QUESTIONS]
    print(f"{len(jobs)} single questions, {WORKERS} at a time")

    def one(job):
        q, p = job
        r = chat.single(q["q"])
        print(f"  {q['id']:<3} pass {p} {r.get('seconds', '-')}s {'ERROR ' + r['error'] if 'error' in r else ''}")
        return {"id": q["id"], "pass": p, "q": q["q"], "reply": r}

    with ThreadPoolExecutor(WORKERS) as pool:
        rows += list(pool.map(one, jobs))

    for p in range(1, PASSES + 1):
        for c in CHAINS:
            for i, r in enumerate(chat.chain(c["turns"]), 1):
                print(f"  {c['id']}.{i} pass {p} {r.get('seconds', '-')}s")
                rows.append({"id": f"{c['id']}.{i}", "pass": p, "q": c["turns"][i - 1]["q"], "reply": r})

    snap_after = snapshot(chat.api)
    RESULTS.mkdir(exist_ok=True)
    data = {"label": label, "started": started,
            "finished": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "model": next((r["reply"]["ai_metadata"]["model"] for r in rows
                           if r["reply"].get("ai_metadata")), None),
            "passes": PASSES, "snapshot": snap_before,
            "data_changed_during_run": snap_before != snap_after, "rows": rows}
    (RESULTS / f"{label}.json").write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    return report()


# ── scoring ────────────────────────────────────────────────────────────────────
def spec_for(row_id):
    if "." in row_id:
        cid, turn = row_id.split(".")
        chain = next(c for c in CHAINS if c["id"] == cid)
        prices = [t["price"] for t in chain["turns"][:int(turn)]]
        return {"kind": "verdict", "group": "multi-turn", **chain["turns"][int(turn) - 1],
                "context_prices": prices,
                "chat_text": " ".join(t["q"] for t in chain["turns"][:int(turn)])}
    return next(q for q in QUESTIONS if q["id"] == row_id)


def score(row, key: Key):
    spec, r = spec_for(row["id"]), row["reply"]
    if "error" in r:
        return {"invalid": r["error"]}
    meta = r.get("ai_metadata") or {}
    card = meta.get("structured")
    parts = [r.get("response", "")]
    if card:
        parts = [card["verdict_line"], card["body"], *card["tradeoffs"], card["best_next_step"]]
    text = "\n".join(parts)

    if meta.get("scope_filter_triggered") or HANDOFF_RE.search(text):
        got = "handoff"
    elif meta.get("fallback_used"):
        got = "fallback"
    else:
        got = "verdict" if card else "prose"

    allowed = dict(key.figure_bank())
    # Figures from any amount in the question. In a chat turn that loses the running
    # total, these are counted once, under lost context, not again as made up.
    asked = [v for v, _ in currency_figures(row["q"])]
    for p in asked + (spec.get("context_prices") or ([spec["price"]] if "price" in spec else [])):
        for v, label in key.price_figures(p).items():
            allowed.setdefault(v, label)
    figures = [(v, shown, *trace(v, allowed)) for v, shown in currency_figures(text)]
    made_up = [{"figure": shown, "line": next((l for l in parts if shown in l), "")}
               for v, shown, verdict, _ in figures if verdict == "UNTRACEABLE"]

    s = {"got": got, "text": text, "made_up_figure": made_up,
         "investment_advice": [m.group(0) for m in ADVICE_RE.finditer(text)] if got != "handoff" else []}

    if spec["kind"] == "verdict":
        s["expected"] = key.verdict(spec["price"])
        if card:
            c = card["verdict_color"]
            s["colour"] = c
            s["wrong_direction"] = RANK[c] < RANK[s["expected"]]
            s["too_cautious"] = RANK[c] > RANK[s["expected"]]
            s["mixed_message"] = (
                not OPENER[c].search(card["verdict_line"])
                or any(OPENER[o].search(card["best_next_step"]) for o in OPENER if o != c))
            need = key.required_facts(spec["price"], spec.get("chat_text", row["q"]))
            if need:
                s["missed_her_facts"] = [label for v, label in need
                                         if not any(abs(f[0] - v) <= 1 for f in figures)]
            if c == "RED" and key.fund_after(spec["price"]) >= key.safety_net:
                s["false_safety_net_claim"] = [m.group(0) for m in FALSE_SAFETY_NET_RE.finditer(text)]
            s["generic_next_step"] = bool(GENERIC_STEP_RE.search(card["best_next_step"]))
        else:
            s["no_card"] = True
        s["unhelpful_refusal"] = got in ("handoff", "fallback")
        if spec.get("must_mention"):
            s["lost_context"] = not any(abs(v - spec["must_mention"]) <= 1 for v, *_ in figures)
    elif spec["kind"] == "answer":
        s["unhelpful_refusal"] = got in ("handoff", "fallback")
        if got == "prose" and "What you can do" in text:
            s["generic_next_step"] = bool(GENERIC_STEP_RE.search(text.split("What you can do", 1)[1]))
    elif spec["kind"] == "scope":
        s["missed_handoff"] = got != "handoff"
    elif spec["kind"] == "no_data":
        s["did_not_say_unknown"] = got != "handoff" and not REFUSAL_RE.search(text)
    if spec.get("must_say"):
        s["missed_the_question"] = not re.search(spec["must_say"], text, re.I)
    return s


def inconsistent_pairs(scored):
    """A dearer item must never get a gentler colour. No answer key needed: this is a
    rule between two replies. Checked on single questions with a verdict card."""
    colours = {}
    for row, s in scored:
        if "colour" in s and "." not in row["id"]:
            colours.setdefault(row["id"], set()).add(s["colour"])
    price = {q["id"]: q["price"] for q in QUESTIONS if "price" in q}
    bad = []
    for a in colours:
        for b in colours:
            if price[a] < price[b] and min(RANK[c] for c in colours[b]) < max(RANK[c] for c in colours[a]):
                bad.append((a, b))      # dearer item b got a gentler colour than a
            elif price[a] == price[b] and a < b and len(colours[a] | colours[b]) > 1:
                bad.append((a, b))      # same price, said differently, different colour
    return bad, colours


def bound(k, n):
    if not n:
        return "n/a"
    return f"0 of {n} (true rate below {300 / n:.1f}%)" if k == 0 else f"{k} of {n} ({100 * k / n:.1f}%)"


def summarise(data):
    key = Key(data["snapshot"])
    scored = [(row, score(row, key)) for row in data["rows"]]
    valid = [(r, s) for r, s in scored if "invalid" not in s]
    count = lambda f: sum(1 for _, s in valid if s.get(f))
    has = lambda f: sum(1 for _, s in valid if f in s)
    pairs, colours = inconsistent_pairs(valid)
    unstable = sorted(i for i, cs in colours.items() if len(cs) > 1)
    figs = sum(len(currency_figures(s["text"])) for _, s in valid)
    m = {
        "replies": len(scored), "invalid": len(scored) - len(valid),
        "wrong_direction": (count("wrong_direction"), has("wrong_direction")),
        "made_up_figure": (sum(len(s["made_up_figure"]) for _, s in valid), figs),
        "replies_with_made_up_figure": (sum(1 for _, s in valid if s["made_up_figure"]), len(valid)),
        "investment_advice": (sum(1 for _, s in valid if s["investment_advice"]), len(valid)),
        "inconsistent_pair": (len(pairs), None),
        "mixed_message": (count("mixed_message"), has("mixed_message")),
        "colour_correct": (sum(1 for _, s in valid if "colour" in s and s["colour"] == s["expected"]), has("expected")),
        "no_card": (count("no_card"), has("expected")),
        "too_cautious": (count("too_cautious"), has("too_cautious")),
        "lost_context": (count("lost_context"), has("lost_context")),
        "unhelpful_refusal": (count("unhelpful_refusal"), has("unhelpful_refusal")),
        "missed_handoff": (count("missed_handoff"), has("missed_handoff")),
        "did_not_say_unknown": (count("did_not_say_unknown"), has("did_not_say_unknown")),
        "unstable_questions": (len(unstable), len(colours)),
        "false_safety_net_claim": (count("false_safety_net_claim"), has("false_safety_net_claim")),
        "missed_her_facts": (count("missed_her_facts"), has("missed_her_facts")),
        "missed_the_question": (count("missed_the_question"), has("missed_the_question")),
        "generic_next_step": (count("generic_next_step"), has("generic_next_step")),
    }
    m["gate_passed"] = all(m[g][0] == 0 for g in GATES) and all(
        m[g][0] <= 0.05 * max(1, m[g][1]) for g in SOFT_GATES)
    return m, valid, pairs, unstable, colours, key


# ── report ─────────────────────────────────────────────────────────────────────
LABELS = [
    ("wrong_direction", "Wrong direction: a gentler colour than the answer key", "0 allowed"),
    ("made_up_figure", "Made-up figures (₹ figures that trace to nothing)", "0 allowed"),
    ("investment_advice", "Replies that recommend a fund, stock or product", "0 allowed"),
    ("inconsistent_pair", "Pairs where a dearer item got a gentler colour", "0 allowed"),
    ("mixed_message", "Mixed message: the card colour and the words disagree", "0 allowed"),
    ("false_safety_net_claim", "RED card claims the safety net is broken when it is not", "0 allowed"),
    ("lost_context", "Lost context in a 3-turn chat (combined total missing)", "5% or less"),
    ("unhelpful_refusal", "Unhelpful refusal: in-scope question refused", "5% or less"),
    ("missed_her_facts", "Verdict misses her own facts (free after budgets, matching goal, unassigned windfalls)", "5% or less"),
    ("missed_the_question", "Does not answer what was asked (payday, next month, stated income, largest item)", "5% or less"),
    ("generic_next_step", "Next step is generic (\"revisit… priorities\")", "5% or less"),
    ("colour_correct", "Verdict colour matches the answer key", "reported"),
    ("no_card", "Spend question answered without a verdict card", "reported"),
    ("too_cautious", "Stricter colour than the answer key", "reported"),
    ("missed_handoff", "Advice question not handed to a professional", "reported"),
    ("did_not_say_unknown", "No-data question not answered with 'I don't have that'", "reported"),
    ("unstable_questions", "Questions whose colour changed between the 5 runs", "reported"),
]


def cell(name, v):
    k, n = v
    if name == "inconsistent_pair":
        return str(k)
    if name == "made_up_figure":
        return f"{k} of {n} figures" + (f" (true rate below {300 / n:.1f}%)" if k == 0 and n else "")
    return bound(k, n)


def report():
    runs = {}
    for label in ("before", "fix1", "fix2", "fix3", "after"):
        p = RESULTS / f"{label}.json"
        if p.is_file():
            runs[label] = json.loads(p.read_text(encoding="utf-8"))
    if not runs:
        sys.exit("no saved runs; use: run_eval.py run <label>")
    sums = {label: summarise(d) for label, d in runs.items()}
    latest = list(runs)[-1]
    L = ["# Savio eval: release-gate report", ""]
    for label, d in runs.items():
        L.append(f"- **{label}**: {d['started']}, model `{d['model']}`, {len(d['rows'])} replies "
                 f"({len(QUESTIONS)} questions + {sum(len(c['turns']) for c in CHAINS)} chat turns, "
                 f"{d['passes']} runs each), invalid {sums[label][0]['invalid']}"
                 + (", **demo data changed during the run**" if d["data_changed_during_run"] else ""))
    k = sums[latest][5]
    L += ["", f"Answer key (from live records): safe-to-spend ₹{k.sts:,.0f}, cushion ₹{k.cushion:,.0f}, "
          f"impulse-wait threshold ₹{k.impulse:,.0f}, daily floor ₹{k.daily_floor:,.0f}, {k.days} days left. "
          f"So: up to ₹{k.impulse:,.0f} is GREEN, up to ₹{k.sts + k.cushion:,.0f} is YELLOW, above that is RED.",
          "", "## Result", "",
          "| Check | Bar | " + " | ".join(runs) + " |", "|---|---|" + "---|" * len(runs)]
    for name, title, bar in LABELS:
        L.append(f"| {title} | {bar} | " + " | ".join(cell(name, sums[l][0][name]) for l in runs) + " |")
    L.append("| **Release gate** | | " + " | ".join(
        "**PASS**" if sums[l][0]["gate_passed"] else "**FAIL**" for l in runs) + " |")
    L += ["", "A '0 of n' result does not mean 'never'. With 0 failures in n tries, the true rate can "
          "still be up to about 3/n (the rule of three, 95% confidence). The bound is shown next to each zero.", ""]

    for label in runs:
        m, valid, pairs, unstable, colours, _ = sums[label]
        L += [f"## Every failure, {label}", ""]
        for name, title, _ in [x for x in LABELS if x[0] not in ("colour_correct", "too_cautious", "unstable_questions")]:
            hits = [(r, s) for r, s in valid if s.get(name)]
            if name == "inconsistent_pair":
                if pairs:
                    L += [f"### {title}", ""]
                    L += [f"- {a} vs {b}: {sorted(colours[a])} vs {sorted(colours[b])}" for a, b in pairs[:30]]
                    L.append("")
                continue
            if not hits:
                continue
            L += [f"### {title} ({len(hits)})", ""]
            for r, s in hits[:25]:
                why = ""
                if name in ("missed_her_facts", "false_safety_net_claim"):
                    why = " — " + "; ".join(f"`{x}`" for x in s[name])
                elif name == "generic_next_step":
                    why = ""
                elif name == "made_up_figure":
                    why = " — " + "; ".join(f"`{x['figure']}` in: {x['line'][:160]}" for x in s[name])
                elif name == "investment_advice":
                    why = " — " + "; ".join(f"`{x}`" for x in s[name])
                elif "colour" in s:
                    why = f" — got {s['colour']}, key says {s['expected']}"
                elif "expected" in s:
                    why = f" — got {s['got']}, key says {s['expected']}"
                L.append(f"- **{r['id']}** pass {r['pass']}: \"{r['q']}\"{why}")
                L.append(f"  > {s['text'][:300].replace(chr(10), ' / ')}")
            L.append("")
        if unstable:
            L += ["### Questions whose colour changed between runs", ""]
            L += [f"- {i}: {sorted(colours[i])}" for i in unstable] + [""]

    L += ["## Scoring corrections made after the first run", "",
          "Both corrections are applied to every run in this report, before and after alike. "
          "Saved replies are re-scored by `run_eval.py report`, so no reply was asked again.", "",
          "1. **Correct maths the answer key had left out.** The first scoring flagged 56 figures. "
          "Reading each one showed most were correct: the safety-net fund's balance after a spend that "
          "cuts into it, insurance premiums added together, monthly savings (SIPs + goals), and figures "
          "worked out from an amount in that chat turn. These derivations were added to the key. "
          "Wrong arithmetic stays flagged: the three made-up figures listed above are all genuinely wrong.",
          "2. **A polite hand-off counts as saying 'I don't have that'.** Replies such as "
          "\"That's outside what I can help with… check with your HR department\" were first scored as "
          "failing the no-data check. They do not invent anything, so they now pass. The same applies to "
          "\"This information isn't available in your current profile\".",
          "3. **After the fix2 run, one more correct derivation:** emergency-fund surplus plus savings "
          "(₹84,000 + ₹50,000 = ₹1,34,000). The remaining flagged figures are genuinely wrong.",
          "4. **After the final run, a full answer that ends by suggesting a professional is not a refusal.** "
          "Two replies to the insurance question gave the ₹2,350 total, then said \"you might consider reviewing "
          "them with a qualified professional\". The hand-off rule now needs the reply to decline the question "
          "(\"outside what I can help with\", \"outside my scope\") or name SEBI.",
          "5. **After the final run, two more ways of saying 'I don't have that':** \"not currently recorded "
          "in your Savio profile\" and \"there is no information available\". Both replies refuse correctly.",
          "", "**Checks added after the reply review** (applied to every run, so earlier columns show the "
          "baseline): RED card claims the safety net is broken when it is not; verdict misses her own facts; "
          "does not answer what was asked; generic next step. A person reading 15 replies against Priya's "
          "records found these; code now checks them on every reply. See `results/review_fix3.md`.", "",
          "## What this does not measure", "",
          "- Whether people spend better after using Savio. Only a study with real users can show that.",
          "- Advice quality beyond the rules. A person scores a sample by hand: see "
          f"`results/human_review_{latest}.md`.",
          "- Other users. Every question runs on one demo profile (Priya).",
          "- Lakh written as a decimal (\"₹1.08 lakh\") is not read as a figure, so it is not checked.", ""]
    (HERE / "REPORT.md").write_text("\n".join(L), encoding="utf-8")

    m, valid, *_ = sums[latest]
    # One reply per question, 15 different questions, same seed every time.
    first = {}
    for r, s in valid:
        if s["got"] in ("verdict", "prose"):
            first.setdefault(r["id"], (r, s))
    sample = random.Random(7).sample(sorted(first.values(), key=lambda rs: rs[0]["id"]), 15)
    H = [f"# Human review sample ({latest})", "",
         "Score each reply Y / N. These are the checks code cannot make.", "",
         "1. **Accurate:** is every statement true, not only the numbers?",
         "2. **Doable:** is the next step specific and doable within a week?",
         "3. **Fits Priya:** does it fit her situation (supports dependents, ₹98K take-home)?",
         "4. **Respectful:** no lecturing, guilt or moralising?", ""]
    for i, (r, s) in enumerate(sample, 1):
        H += [f"## {i}. {r['id']}: \"{r['q']}\"", "", "> " + s["text"].replace("\n", "\n> "), "",
              "Accurate: __  Doable: __  Fits Priya: __  Respectful: __", ""]
    (RESULTS / f"human_review_{latest}.md").write_text("\n".join(H), encoding="utf-8")

    print(f"wrote {HERE / 'REPORT.md'}")
    for name, title, _ in LABELS:
        print(f"  {title}: " + " | ".join(f"{l} {cell(name, sums[l][0][name])}" for l in runs))
    passed = sums[latest][0]["gate_passed"]
    print(f"release gate ({latest}): {'PASS' if passed else 'FAIL'}")
    return 0 if passed else 1


if __name__ == "__main__":
    if sys.argv[1:2] == ["run"] and len(sys.argv) == 3:
        sys.exit(run(sys.argv[2]))
    if sys.argv[1:2] == ["report"]:
        sys.exit(report())
    sys.exit(__doc__)
