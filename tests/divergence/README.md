# Figure-traceability test

**There are two divergence tests in this repo. They answer different questions.**

| | [`docs/divergence-tests.md`](../../docs/divergence-tests.md) | this folder |
|---|---|---|
| Question | *What does Savio add over a plain chatbot?* | *How often does the model state a number it cannot back?* |
| Method | Same questions to Savio and to raw Gemini, side by side | Every figure checked against the same figure computed in code |
| Runs against | The live `chat-respond` endpoint | Gemini directly, using the seed as the record |
| Output | A demonstration you read | A rate with a denominator |
| Verified by | Savio's own guard (`meta.verified`) | An engine outside the system under test |

Use the first to show what the product does. Use this one to measure whether it
invents. Neither replaces the other: the first tests the shipped product but lets it
report on itself, and this one checks independently but does not yet call the
shipped endpoint.

## What this measures

Savio's design rule is that **code works out every number and the model only writes
the sentence around it**. This test checks whether the rule holds.

`ground_truth.py` computes every figure Priya's records can support, in plain
arithmetic, with no model involved. The runner then reads each answer and checks
every rupee figure against it. Anything untraceable was invented.

Two arms give it a control:

- **Arm A** — the model gets the raw records and does its own arithmetic.
- **Arm B** — the model gets figures already computed in code and is told to use no
  others. This is the shipped design contract.

## Running it

```
python tests/divergence/run_divergence.py     # ask the model, score every answer
python tests/divergence/run_divergence.py --rescore   # re-score saved answers, no API calls
python tests/divergence/make_report.py        # write REPORT.md from the results
```

Needs `GEMINI_API_KEY`; the runner reads `.env.local`, or set `SAVIO_ENV` to point at
another env file. The key is never written to disk or into the report.

## Why the ground truth can be trusted

Two independent checks, both of which pass:

- The seed's own comment states the non-investing outflow as **₹47,468**.
- The live `chat-respond` endpoint reported safe-to-spend as **₹26,532** in
  `docs/divergence-tests.md`, computed by entirely different code.

Both match what `ground_truth.py` computes. Two separate paths landing on the same
figures is the reason to trust the rest.

## Results

See [`REPORT.md`](REPORT.md). Headline from the run of 2026-08-10: letting the model
do the arithmetic produced **19 untraceable figures in 126**; handing it figures
computed in code produced **0 in 83**.

The failures are worth reading rather than counting. The model twice subtracted the
*variable* budgets from safe-to-spend — which the seed comment explicitly says not to
do, because variable commitments sit inside the discretionary bucket — and once added
the unallocated windfalls into safe-to-spend, which is the same "that money is
already spoken for" mistake the adversarial scenarios were written to catch.

## Limits

- **Tests the design rule, not the shipped endpoint.** Pointing the runner at
  `chat-respond` instead of at Gemini directly is the obvious next version, and would
  give a hallucination rate for the product rather than for the pattern.
- **One persona.** Every scenario is Priya's seeded state.
- **Small sample.** Enough to compare the arms; not enough to quote a population rate.
- **Temperature 0 is repeatable, not deterministic.** Scenarios that failed on some
  passes and not others are reported that way.
