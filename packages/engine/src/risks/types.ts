export type RiskSeverity = 'low' | 'medium' | 'high';

export interface Risk {
  module_id: string;
  rule: string;
  evidence: Record<string, unknown>;
  severity: RiskSeverity;
}
