import { z } from 'zod';

// PLAN.md's LLM output contract, exactly.
export const FindingSchema = z.object({
  module_id: z.string(),
  claim: z.string(),
  supporting_metric: z.string(),
  value_cited: z.number(),
});

export const SynthesisOutputSchema = z.object({
  summary: z.string(),
  findings: z.array(FindingSchema),
});

export type RawFinding = z.infer<typeof FindingSchema>;
export type RawSynthesisOutput = z.infer<typeof SynthesisOutputSchema>;

// Numeric module fields a finding is allowed to cite. `id` (string) and
// `in_cycle` (boolean) are deliberately excluded — value_cited is always a
// number per the contract, so a finding citing either is ungroundable by
// construction, not merely "wrong".
export const CITABLE_NUMERIC_FIELDS = [
  'loc',
  'cyclomatic_complexity',
  'fan_in',
  'fan_out',
  'instability',
  'churn_commits_90d',
  'hotspot_score',
  'blast_radius',
] as const;

export type CitableNumericField = (typeof CITABLE_NUMERIC_FIELDS)[number];

export type RejectionReason =
  | 'unknown_module_id'
  | 'unknown_metric'
  | 'null_metric_value'
  | 'numeric_mismatch';

export interface RejectedFinding {
  finding: RawFinding;
  reason: RejectionReason;
  detail: string;
}

export interface ValidationResult {
  schemaValid: boolean;
  summary: string | null;
  acceptedFindings: RawFinding[];
  rejectedFindings: RejectedFinding[];
}
