# ADR 0004: Percentile-rank normalization for hotspot fusion (not min-max, not z-score)

## Status

Accepted

## Context

`docs/PLAN.md`: `hotspot_score = normalized(complexity) × normalized(churn)`.
"Normalized" needs a precise definition — three candidates were considered:

1. **Min-max scaling**: `(x - min) / (max - min)`, mapped to `[0, 1]`.
2. **Z-score**: `(x - mean) / stddev`.
3. **Percentile rank** (rank within the population, not raw magnitude).

## Decision

Percentile rank, defined precisely as:

```
normalized(x) = |{ v in population : v < x }| / (n - 1)     for n > 1
normalized(x) = NaN                                          for n ≤ 1
```

i.e. the fraction of the population **strictly less than** `x`. Applied
independently to the complexity population and the churn population, then
multiplied.

### This is a deliberate variant, not the textbook percentile rank

Standard definitions of "percentile rank" in statistics packages typically
use one of:
- `count(v <= x) / n` (inclusive-count, divide by full n), or
- the "mean rank" method for ties: tied values get the **average** of the
  ranks they'd span (e.g. two tied-for-1st values both get rank 1.5).

This project uses neither. It uses **strict** `count(v < x)` (ties get the
rank of the bottom of their tied group, not an average), divided by
`n - 1` (not `n`). This specific pair of choices is what gives the two
properties this project actually needs:

- Dividing by `n - 1` (not `n`) anchors a **unique** minimum to exactly
  `0.0` and a **unique** maximum to exactly `1.0` — matching the intuitive
  "0 to 1, worst to best" scale that `docs/PLAN.md`'s schema implies,
  which `count(v<=x)/n` does not give you (the max would land at
  `(n-1)/n`, e.g. `0.9` for `n=10`, not `1.0`).
- Using **strict** `<` (not `<=`) and giving every member of a tied group
  the *same* score is what makes "identical raw value → identical
  normalized value" a clean, always-true invariant — no averaging step to
  explain or get subtly wrong.

Anyone comparing this project's normalized numbers against a stats
library's built-in "percentile rank" function should expect small
differences at the boundaries and on ties; this is intentional, not a bug
to reconcile.

### Why not min-max

Min-max's flaw is that a single outlier rescales *everyone else's* score,
not just its own. Concretely, for churn values `[1, 2, 3, 4, 5, 200]`:

- min-max: `1→0.000, 2→0.005, 3→0.010, 4→0.015, 5→0.020, 200→1.000` — the
  five ordinary files become indistinguishable from each other, all
  crushed near zero by the one outlier.
- percentile rank: `1→0.0, 2→0.2, 3→0.4, 4→0.6, 5→0.8, 200→1.0` — the
  outlier only affects its own score; everyone else keeps a meaningfully
  spread-out ranking.

Real churn distributions are typically power-law-shaped (a few files churn
constantly, most rarely) and real complexity distributions are similarly
skewed (a few large/tangled files, many small ones). Min-max's failure
mode — outlier compresses everyone else — directly undermines this
project's headline feature (a *ranking* of hotspots), and would plausibly
break in the demo's second beat (`docs/PLAN.md`: "run it on a recognizable
mid-size open-source repo, land on the hotspot ranking").

Trade-off, stated honestly: percentile rank can *exaggerate* small
absolute differences when the underlying population has low variance
(e.g. 99 files churned once, one churned twice → that one file scores
close to the top). This is judged less harmful than min-max's failure mode
for a ranking-first tool.

### Why not z-score

Disqualifying, not just a preference: z-scores are signed and unbounded.
In a **multiplicative** formula, two below-average values (both negative
z-scores) multiply to a **positive** result — an ordinary file with
below-average complexity *and* below-average churn could incorrectly
receive an elevated `hotspot_score`. That is a correctness bug baked into
the formula's math, not a stylistic concern, so z-score was never a live
option once the formula was fixed as a product of two normalized terms.

## Consequences

### Reference population: all modules in the current run, no other frame

Normalization is computed once, over every module in that analysis run
(no per-directory/per-package sub-scoping) — consistent with
`docs/PLAN.md`'s "single fused hotspot ranking," not several disconnected
ones.

### `n ≤ 1` → `NaN`, same discipline as ADR 0001

If the population has 0 or 1 members, `n - 1 ≤ 0` and the formula is
mathematically undefined. Following the precedent in
`docs/adr/0001-instability-nan-for-isolated-modules.md`: this returns
`NaN`, not a fabricated `0`/`0.5`/`1`. `hotspot_score` (a product involving
that `NaN`) is therefore also `NaN`, and serializes to JSON `null`, same
as instability's isolated-module case.

### All-equal population → everyone scores `0.0`, not `1.0` or `0.5`

If every module in the population has the **same** value for a metric
(e.g. every file has `cyclomatic_complexity = 5`), then for each of them
`count(v < x) = 0`, so `normalized(x) = 0 / (n - 1) = 0.0` for **all** of
them — not `1.0` (which might be intuitively expected, "everyone's at the
max") and not `0.5`.

This is a direct, intentional consequence of the strict-`<` definition,
not a bug: with zero variance in the population, there is nothing to rank
anyone *above*, so nobody is elevated above baseline. Docs, code comments,
and `fixtures/complex-functions/EXPECTED.md` all call this out explicitly,
and it has a dedicated unit test — this is exactly the kind of
non-obvious, easy-to-silently-mis-assume behavior this project's
discipline requires surfacing rather than leaving implicit.

### Module set is authoritative from the complexity side

`computeHotspotScore(complexity, churn)` uses the **complexity** result's
module set as the definition of "modules that currently exist." A module
in `churn` but absent from `complexity` (a file git touched inside the
churn window but which no longer exists — deleted, or renamed with
`--no-renames` treating it as delete+add, see
`docs/adr/0002-type-only-imports-excluded-from-graph.md`'s sibling
decision on scope) is dropped entirely: not in the output, and not part of
either normalization population. A module in `complexity` but absent from
`churn` gets `churn_commits = 0` — a real, well-defined value (git
genuinely shows zero commits touching it in that window), not a fabricated
default.
