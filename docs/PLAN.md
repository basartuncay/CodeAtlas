# CodeAtlas — Project Plan

## Positioning

CodeAtlas is a deterministic architecture & change intelligence tool. It analyzes a
codebase's structure (dependency graph, coupling, instability, cycles) and its history
(Git churn, change concentration) and **fuses** both into a single hotspot ranking.
An LLM synthesis layer produces a human-readable narrative **grounded strictly in the
deterministic model** — every claim it makes is validated against the model and
rejected if it references a module, metric, or value not actually present.

This is not claimed to be a novel category. Similar tools exist (ArchMind, CodeMap,
DevLens, CodeAutopsy). The differentiation is:

1. Coupling/instability **fused with** churn into one deterministic hotspot score
   (most tools show these as separate, unconnected metrics).
2. A **grounding/hallucination-rejection validator** on the LLM output — schema
   validation, referential integrity against real module IDs, and numeric tolerance
   checks against the real computed values. This is demoed live, including a
   deliberately rejected hallucinated claim.
3. CodeAtlas analyzes **itself** in CI as a quality gate, not just a demo target.

## Scope discipline

**MUST HAVE**
- Single language: TypeScript/JavaScript
- Import/dependency graph (dependency-cruiser or ts-morph)
- Per-module: LOC, cyclomatic complexity, fan-in, fan-out, instability (I = Ce/(Ca+Ce))
- Cycle detection via Tarjan's SCC algorithm
- Blast radius via BFS reachability over the dependency graph
- Git churn (commits touching each file over last N commits/days)
- Change concentration (distribution of commits across files)
- Hotspot score = normalized(complexity) × normalized(churn)
- Versioned, structured JSON data model (see below)
- Deterministic rule-based risk flags (explicit thresholds, no LLM guessing)
- LLM synthesis layer reading ONLY the structured JSON (never raw source)
- Grounding validator: schema check → referential integrity → numeric tolerance
- Dashboard: dependency graph view, hotspot ranking, drill-down per module,
  narrative panel showing accepted (and any rejected) LLM findings
- Unit tests for the deterministic engine (graph, metrics, churn, hotspot fusion)
- Golden-file/snapshot test: full pipeline on a fixture repo → checked-in expected JSON
- Contract tests for the grounding validator (pre-recorded good/corrupted LLM responses)
- CI: test suite + self-analysis job (CodeAtlas analyzes its own repo on every push)
- Docker Compose one-command setup
- README with architecture diagram, screenshot/GIF, design rationale section
- 3-5 short ADRs in docs/adr/

**SHOULD HAVE** (only if MUST HAVE is done with time to spare)
- Second language support (Python via radon) to show the model generalizes
- Redis caching for repeat analysis of an unchanged commit

**NICE TO HAVE** (cut first if behind schedule)
- Exportable Markdown/PDF report
- Public hosted demo pre-loaded with 2-3 real repos
- Score trend across multiple analyzed commits

**DO NOT BUILD**
- Universal multi-language support
- Auth, billing, multi-tenancy
- Generic "chat with your repo" Q&A box
- Auto-fix / code-rewriting agent (different project entirely)
- Kafka, microservices, Kubernetes, or any infra not needed at this scale
- Security pattern detection (scope trap — either shallow or too deep for 48h)
- Soft/unexplainable composite scores (e.g. "Testability: 61/100" with no formula)
- Multiple parallel LLM reviewer subagents (architecture/security/testing) —
  one well-structured synthesis call is the right scope, not multi-agent orchestration

## Deterministic data model (JSON schema, versioned)

```json
{
  "schema_version": "1.0",
  "repo": { "url": "...", "commit": "sha", "analyzed_at": "iso8601" },
  "modules": [
    {
      "id": "src/services/PaymentService.ts",
      "loc": 340,
      "cyclomatic_complexity": 42,
      "fan_in": 11,
      "fan_out": 6,
      "instability": 0.35,
      "churn_commits_90d": 27,
      "hotspot_score": 0.81,
      "blast_radius": 17,
      "in_cycle": false
    }
  ],
  "edges": [{ "from": "moduleA", "to": "moduleB" }],
  "cycles": [["moduleA", "moduleB", "moduleC"]],
  "risks": [
    {
      "module_id": "src/services/PaymentService.ts",
      "rule": "high_hotspot",
      "evidence": { "hotspot_score": 0.81, "threshold": 0.7 },
      "severity": "high"
    }
  ]
}
```

Every risk carries raw `evidence` numbers — this is what the grounding validator
checks findings against.

## LLM contract

- **Input**: the structured JSON model only. Never raw source code, never diffs.
- **Output**: forced structured JSON:
```json
{
  "summary": "...",
  "findings": [
    {
      "module_id": "src/services/PaymentService.ts",
      "claim": "...",
      "supporting_metric": "hotspot_score",
      "value_cited": 0.81
    }
  ]
}
```

## Grounding / hallucination rejection

Three checks, in order:
1. **Schema validation** — output must parse against the JSON schema; one retry on failure.
2. **Referential integrity** — every `module_id` cited must exist in `modules`.
   Unknown module → finding dropped, logged as a rejected hallucination.
3. **Numeric grounding** — `value_cited` must match the model's actual value within
   tolerance (±0.01). Mismatch → finding dropped.

Log every rejection. Demo this live — a rejected finding is more convincing than
any number of accepted ones.

## Testing strategy

- Unit tests on the deterministic engine (the priority — not the LLM layer):
  - SCC/cycle detection against hand-built fixture graphs with known cycles
  - Instability/hotspot formulas against hand-computed expected values on a small
    fixture repo (3-5 files, checked into `fixtures/`)
  - Churn parser against a fixture git repo with fixed, known commit history
- Golden-file test: full pipeline on the fixture repo → assert output matches a
  checked-in expected JSON
- Contract tests for the grounding validator: pre-recorded good AND corrupted LLM
  responses, assert correct accept/reject behavior. Never call a live LLM in CI.
- Integration smoke test: run the full pipeline against CodeAtlas's own repo,
  assert it completes and produces a non-empty model

## Demo scenario (3 beats)

1. Run CodeAtlas on itself, live.
2. Run it on a recognizable mid-size open-source repo, land on the hotspot ranking,
   click into the top hotspot, show the real underlying numbers.
3. Deliberately trigger a rejected LLM claim (replay a corrupted response or ask
   something ungroundable) and show the validator catching it live.

## Self-analysis

GitHub Actions job on every push: run the full pipeline against the repo's own
current commit, publish the JSON model as a build artifact, optionally fail the
build if hotspot count or max complexity regresses past a defined threshold.

## Repository structure

```
CodeAtlas/
├── packages/
│   ├── engine/          # pure, testable: graph, metrics, churn, hotspots
│   ├── llm-synthesis/   # prompt templates, schema, grounding validator
│   ├── api/             # thin HTTP layer over engine + llm-synthesis
│   └── web/              # Next.js dashboard
├── fixtures/             # tiny fixture repo(s) for deterministic tests
├── docs/
│   └── adr/              # 3-5 short architecture decision records
├── .github/workflows/    # CI: tests + self-analysis quality gate
├── docker-compose.yml
└── README.md
```

## Implementation order

1. Engine core: import graph + complexity + fan-in/fan-out — get this correct and
   tested first, everything else depends on it
2. Git churn parser + hotspot score fusion
3. Cycle detection (Tarjan) + blast radius (BFS)
4. Finalize JSON schema, write golden-file test against fixture repo
5. LLM synthesis prompt + output schema + grounding validator + contract tests
6. Minimal dashboard (graph view + hotspot ranking + narrative panel)
7. CI: test suite + self-analysis job wired in
8. README + ADRs + demo repo selection + rehearse the 3-beat demo

## Checkpoint discipline

Around hour 30: engine + tests + validator should be done. If behind schedule,
cut dashboard polish before cutting engine correctness or tests — a correct engine
with a plain table beats a polished dashboard sitting on wrong numbers.