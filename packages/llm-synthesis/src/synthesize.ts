import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { AnalysisResult } from '@codeatlas/engine';
import { SynthesisOutputSchema, type RawSynthesisOutput } from './types';

// Mid-tier model: this is a bounded summarization/extraction task over a
// small structured JSON document, not open-ended reasoning — see the
// design discussion for why Sonnet over Haiku (numeric-citation fidelity)
// or Opus (cost, unneeded for this task).
const MODEL_ID = 'claude-sonnet-5';
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `You are a static-analysis report summarizer for CodeAtlas.

You will be given ONLY a structured JSON analysis model of a codebase as the user message — never raw source code, never diffs, never anything else. It contains modules with deterministic metrics (loc, cyclomatic_complexity, fan_in, fan_out, instability, churn_commits_90d, hotspot_score, blast_radius, in_cycle), the dependency graph (edges), detected cycles, and pre-computed risk flags.

Your job: write a short (2-4 sentence) human-readable summary of the codebase's architectural health, and a list of findings. Each finding must cite exactly ONE module and ONE numeric metric from the JSON you were given.

Strict rules — every finding will be mechanically checked against the JSON, and any finding that breaks these rules will be discarded:
- "module_id" must be copied character-for-character from the "id" field of a module in the JSON. Never invent, guess, abbreviate, or slightly alter a module_id.
- "supporting_metric" must be exactly one of: loc, cyclomatic_complexity, fan_in, fan_out, instability, churn_commits_90d, hotspot_score, blast_radius.
- "value_cited" must be copied exactly from that module's actual value for that metric in the JSON you were given — never round, estimate, or recompute it.
- Never cite a metric whose value is null for that module.
- Never reference anything not present in the JSON (no raw code, no speculation about implementation details you cannot see, no invented file contents).`;

/**
 * Implements PLAN.md's LLM contract: input is ONLY the structured JSON
 * model (never raw source), output is forced structured JSON via
 * `output_config.format` (Zod-backed structured outputs) — not a
 * tool-use workaround, not prompt + manual JSON.parse. See the design
 * discussion for why.
 *
 * Throws if the response fails schema validation (`parsed_output` is
 * null). PLAN.md calls for "one retry on failure" on schema validation —
 * that retry is the caller's responsibility (e.g. the grounding pipeline
 * that wraps this), not this function's; this function reports pass/fail
 * once per call, the same contract `validateFindings` follows.
 */
export async function synthesizeFindings(model: AnalysisResult): Promise<RawSynthesisOutput> {
  const client = new Anthropic();

  const response = await client.messages.parse({
    model: MODEL_ID,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(model) }],
    output_config: { format: zodOutputFormat(SynthesisOutputSchema) },
  });

  if (!response.parsed_output) {
    throw new Error('LLM response failed schema validation (parsed_output is null)');
  }

  return response.parsed_output;
}
