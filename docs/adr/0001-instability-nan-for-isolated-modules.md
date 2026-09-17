# ADR 0001: Instability is `NaN` (not defaulted) for isolated modules

## Status

Accepted

## Context

Instability is computed as `I = Ce / (Ca + Ce)`, where `Ce` is fan_out and
`Ca` is fan_in (`packages/engine/src/metrics/coupling.ts`).

A module with `fan_in = 0` and `fan_out = 0` — one that imports nothing and
is imported by nothing — is an isolated module. For such a module the
formula divides `0 / 0`, which in JavaScript evaluates to `NaN`, not an
error and not `0`.

We could have special-cased this to some default (`0`, meaning "fully
stable", or `1`, meaning "fully instable", or omitting the field entirely).
Any of those would be a fabricated number: instability is only meaningful
relative to a module's coupling, and a module with zero coupling has no
coupling to measure stability *of*. This directly matches the project's
scope-discipline rule (docs/PLAN.md, "DO NOT BUILD"): **no soft/unexplainable
composite number gets invented to fill a gap** — if a value can't be
derived from the model, it doesn't get a value.

## Decision

`computeCouplingMetrics` does not special-case the zero/zero case. It always
returns `fan_out / (fan_in + fan_out)`, and lets that be `NaN` when both are
zero. This is asserted directly by a unit test
(`packages/engine/tests/metrics/coupling.test.ts`,
"computeCouplingMetrics — isolated module") rather than left as incidental
behavior.

## Consequences

**JSON serialization**: `JSON.stringify` converts `NaN` (and `Infinity`) to
the JSON literal `null` for numeric fields — this is a language-level
behavior of `JSON.stringify`, not something CodeAtlas has to implement.
Concretely:

```js
JSON.stringify({ instability: NaN }); // '{"instability":null}'
```

This means when a module's metrics are serialized into the deterministic
JSON model (docs/PLAN.md's `modules[]` array), an isolated module's
`instability` field will appear as `null`, not `0` or missing. This is the
correct, honest representation and CodeAtlas relies on it rather than
converting `NaN` to a sentinel number before serializing.

Two obligations follow from this, to be honored when the JSON schema and
downstream consumers (grounding validator, dashboard, LLM synthesis
input) are built in later steps:

1. **Schema**: the `instability` field's JSON Schema type must be
   `["number", "null"]`, not `"number"`. A schema that requires `"number"`
   would reject every isolated-module entry.
2. **Consumers**: the dashboard and the LLM synthesis layer must treat
   `instability: null` as "not applicable" (e.g. render "—" / exclude from
   ranking), never coerce it to `0` for sorting or display — doing so would
   silently reintroduce the fabricated-default problem this ADR rejects.

Rule-based risk flags (later step) that read `instability` must also treat
`null` as "does not match" rather than crashing or coercing to `0`.
