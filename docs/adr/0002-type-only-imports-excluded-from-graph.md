# ADR 0002: Type-only imports are excluded from the dependency graph

## Status

Accepted

## Context

`fixtures/cyclic-project/src/server.ts` and `src/sessionManager.ts` both
have an `import type { Token } from './tokenStore'`. Neither shows up as an
edge in `buildDependencyGraph`'s output — not even as an edge flagged
`typeOnly: true`. They are silently absent from the `dependencies` array
`dependency-cruiser` returns, confirmed against the raw
`dependency-cruiser --output-type json` output for that fixture.

This is `dependency-cruiser`'s documented default, not a bug or an
oversight in our config. Its `tsPreCompilationDeps` option
(`packages/engine` currently leaves it unset, so it takes its default
value) is documented as:

> if true detect dependencies that only exist before typescript-to-javascript
> compilation

Default is `false`. A pure `import type { X } from 'y'` produces **zero
emitted JavaScript** — TypeScript's type-erasure step deletes it entirely.
With `tsPreCompilationDeps: false` (the default), `dependency-cruiser`
reports the graph as it exists in the code that actually runs, i.e. *after*
that erasure — so an import that erases to nothing isn't an edge.

We did not choose this on day one; discovered while reviewing
`fixtures/cyclic-project`'s edges. The question is whether to change it
(pass `tsPreCompilationDeps: true` to capture these too) or keep the
default and document it.

## Decision

Keep the default (`tsPreCompilationDeps: false`, i.e. unset). The
dependency graph — and everything derived from it (fan_in/fan_out/
instability, cycles, blast radius) — models **runtime module coupling
only**: "does this file need that file's code to exist for the program to
run/behave correctly."

Reasoning:

1. **Consistency with blast radius's own definition** (docs/PLAN.md,
   `fixtures/cyclic-project/EXPECTED.md`): blast radius answers "if this
   module's *behavior* changes, what could break at runtime." A type-only
   import carries no runtime behavior — nothing to break at runtime. Mixing
   it into blast radius would answer a different question ("what could fail
   to *compile*") inside the same number, without saying so.
2. **One clearly-defined edge kind is more defensible than two conflated
   ones.** Modeling both runtime coupling and compile-time type coupling in
   a single, undifferentiated edge set would produce fan_in/fan_out/
   instability numbers that mix two different meanings of "coupling"
   silently — exactly the kind of unexplainable composite the project's
   scope discipline (docs/PLAN.md, "DO NOT BUILD") rules out. Properly
   supporting both would mean two separate edge sets/metrics, which is
   scope this 48-hour project does not need.
3. This is a real, known trade-off, not a blind spot: renaming or removing
   an exported type that only ever appears in `import type` positions is a
   real breaking change (it fails the consumer's `tsc` build) that this
   tool's graph, fan-in/fan-out, cycle detection, and blast radius will
   **not** detect or count. Anyone reading a module's blast radius number
   should understand it as "runtime blast radius," not "every way this file
   could break something."

## Consequences

- `fixtures/cyclic-project/src/server.ts → tokenStore.ts` and
  `sessionManager.ts → tokenStore.ts` (both `import type` only) are
  correctly absent from `EXPECTED.md`'s edge list, fan_in/fan_out table,
  and blast-radius BFS — this was already the case before this ADR, it is
  now an intentional, documented property of the fixture rather than an
  unremarked-on gap.
- If a later fixture or real analysis target needs to demonstrate or reason
  about type-only coupling specifically, that is new scope requiring its
  own decision (a separate edge kind, e.g. `edges[].kind: "runtime" |
  "type-only"`) — not a silent addition to the existing edge set.
