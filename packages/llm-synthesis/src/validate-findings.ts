import type { AnalysisResult, ModuleResult } from '@codeatlas/engine';
import {
  CITABLE_NUMERIC_FIELDS,
  SynthesisOutputSchema,
  type CitableNumericField,
  type RawFinding,
  type RejectedFinding,
  type ValidationResult,
} from './types';

// PLAN.md: "Numeric grounding — value_cited must match the model's actual
// value within tolerance (±0.01)."
const NUMERIC_TOLERANCE = 0.01;

function isCitableField(field: string): field is CitableNumericField {
  return (CITABLE_NUMERIC_FIELDS as readonly string[]).includes(field);
}

/** True for a real, comparable number — false for null, undefined, or NaN.
 * A finding's target value can arrive as either NaN (raw in-memory
 * AnalysisResult) or null (after a JSON round-trip, e.g. what an LLM
 * actually sees) — this treats both the same way. See ADR 0001. */
function isGroundedNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

function validateOneFinding(finding: RawFinding, model: AnalysisResult): RejectedFinding | null {
  const module: ModuleResult | undefined = model.modules.find((m) => m.id === finding.module_id);
  if (!module) {
    return {
      finding,
      reason: 'unknown_module_id',
      detail: `no module with id "${finding.module_id}" in the analysis model`,
    };
  }

  if (!isCitableField(finding.supporting_metric)) {
    return {
      finding,
      reason: 'unknown_metric',
      detail: `"${finding.supporting_metric}" is not a recognized numeric module metric`,
    };
  }

  const actualValue: unknown = module[finding.supporting_metric];
  if (!isGroundedNumber(actualValue)) {
    return {
      finding,
      reason: 'null_metric_value',
      detail: `${finding.supporting_metric} has no defined value for ${finding.module_id} (null/NaN) — nothing to ground against`,
    };
  }

  if (Math.abs(actualValue - finding.value_cited) > NUMERIC_TOLERANCE) {
    return {
      finding,
      reason: 'numeric_mismatch',
      detail: `model says ${finding.supporting_metric}=${actualValue} for ${finding.module_id}, LLM cited ${finding.value_cited}`,
    };
  }

  return null;
}

/**
 * Three checks, in order, per PLAN.md:
 * 1. Schema validation (Zod) — independent of however the caller obtained
 *    `rawOutput` (a live `messages.parse()` call or a pre-recorded fixture).
 * 2. Referential integrity — every module_id must exist in the model.
 * 3. Numeric grounding — value_cited within ±0.01 of the real value.
 *
 * Never calls an LLM. Retrying a schema failure is the caller's job, not
 * this function's — it reports pass/fail once per call.
 */
export function validateFindings(rawOutput: unknown, model: AnalysisResult): ValidationResult {
  const parsed = SynthesisOutputSchema.safeParse(rawOutput);
  if (!parsed.success) {
    return { schemaValid: false, summary: null, acceptedFindings: [], rejectedFindings: [] };
  }

  const acceptedFindings: RawFinding[] = [];
  const rejectedFindings: RejectedFinding[] = [];

  for (const finding of parsed.data.findings) {
    const rejection = validateOneFinding(finding, model);
    if (rejection) {
      rejectedFindings.push(rejection);
    } else {
      acceptedFindings.push(finding);
    }
  }

  return { schemaValid: true, summary: parsed.data.summary, acceptedFindings, rejectedFindings };
}
