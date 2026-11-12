# CodeAtlas — instructions for Claude

Deterministic architecture + churn analysis for TS/JS codebases, with one grounded LLM synthesis pass whose claims are validated against the computed JSON. See `README.md` and `docs/PLAN.md`.

## Layout (npm workspaces, Node >= 20)
- `packages/engine` — import graph, coupling/instability, cycles, churn, hotspot score, risk flags. No LLM here, ever.
- `packages/llm-synthesis` — the single LLM call plus the grounding/hallucination validator. The LLM reads only the structured JSON, never raw source.
- `packages/web` — Next.js UI.
- `fixtures/` — small repos used by tests (golden-repo, cyclic-project, churn-repo…). Changing them changes expected outputs.
- `docs/adr/` — decisions (NaN instability, type-only imports, complexity sum, percentile normalization). Read before touching metrics; add an ADR for new metric decisions.
- `action.yml` — GitHub Action; CodeAtlas analyzes itself in CI.

## Commands (same as CI)
- `npm ci`
- `npm run typecheck --workspaces --if-present`
- `npm test --workspaces --if-present`
- `npm run lint --workspace=@codeatlas/web`

## Rules
- Engine output must stay deterministic: same input → same scores and ranking. No LLM or randomness in `packages/engine`.
- Never weaken the validator to make LLM output pass; rejections are shown, not hidden.
- `.env` holds the API key; never commit it.
