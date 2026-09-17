# ADR 0003: File-level cyclomatic complexity is the sum of its functions

## Status

Accepted

## Context

`docs/PLAN.md`'s JSON schema has one `cyclomatic_complexity` number per
module (file), not per function:

```json
{ "id": "src/services/PaymentService.ts", "cyclomatic_complexity": 42, ... }
```

McCabe cyclomatic complexity is inherently a per-function metric (it's
defined over a single function's control-flow graph). A file typically
contains multiple functions, so rolling many per-function numbers up into
one per-file number requires a choice. The candidates:

1. **Sum** of every function's complexity in the file.
2. **Max** — the single most complex function's number.
3. **Average** — mean complexity across functions.

## Decision

Sum. `computeComplexity` reports, for each file, the sum of the cyclomatic
complexity of every function-like declaration in it (top-level and nested
alike — see `fixtures/complex-functions/EXPECTED.md` for exactly which
node kinds count as "function-like" and which AST nodes count as decision
points).

Reasoning:

- **Sum is the only one of the three that's monotonic in file size in an
  explainable way**: a file with ten functions of complexity 3 each is a
  bigger, harder-to-review file than a file with one function of
  complexity 5, and sum reflects that (30 vs 5); max would report both as
  "3" and "5" respectively — actually *understating* the ten-function
  file relative to the one-function file, which is backwards for a tool
  whose stated purpose is flagging risky/hard-to-maintain files.
- **Average silently hides scale.** A file with 20 trivial functions
  (complexity 1 each, average 1) and a file with one complexity-1
  function look identical under "average," even though the first is
  obviously a bigger file to review. This is exactly the kind of
  unexplainable-once-you-look-closer number `docs/PLAN.md`'s scope
  discipline rules out.
- **Sum matches how `hotspot_score` will use it** (Adım 2, not yet
  implemented): `hotspot_score = normalized(complexity) × normalized(churn)`
  is meant to answer "how much dangerous, frequently-changing code lives
  in this file" — total complexity answers that; the single worst
  function's complexity does not (a file could have one clean function and
  nine tangled ones, or vice versa, and "max" would score both files
  identically).

## Consequences

- A file with **zero** function-like declarations (pure re-exports, a
  file of only type/interface declarations) has `cyclomatic_complexity =
  0` — the sum of an empty set, not a fabricated default.
- This number does **not** tell you which single function is the worst
  offender in a file — only that the file as a whole carries that much
  branching. Per-function complexity is not part of the current JSON
  schema (`docs/PLAN.md`) and is out of scope; if a future need arises to
  drill into "which function," that's new scope requiring its own
  decision, not a silent addition here.
- Adding a function to a file always increases that file's complexity
  number, even if the new function is trivial (complexity 1, e.g. a
  one-line helper) — this is intentional per the reasoning above, not an
  oversight.
