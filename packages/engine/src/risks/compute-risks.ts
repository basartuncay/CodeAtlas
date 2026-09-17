import type { Cycle } from '../cycles/types';
import type { Risk } from './types';

/**
 * PLAN.md's own example threshold. A product of two [0,1] percentile
 * ranks exceeding 0.7 requires both to be roughly in the top 15-20%
 * simultaneously — a genuinely strict bar, not an arbitrary round number.
 */
const HIGH_HOTSPOT_THRESHOLD = 0.7;

export interface RiskRuleInput {
  module_id: string;
  hotspot_score: number;
  in_cycle: boolean;
}

function cycleContaining(moduleId: string, cycles: Cycle[]): Cycle {
  return cycles.find((cycle) => cycle.includes(moduleId)) ?? [];
}

export function computeRisks(modules: RiskRuleInput[], cycles: Cycle[]): Risk[] {
  const risks: Risk[] = [];

  for (const module of modules) {
    // NaN > threshold is false in JS, so a NaN hotspot_score (n<=1
    // analysis) never triggers this — no special-casing needed.
    if (module.hotspot_score > HIGH_HOTSPOT_THRESHOLD) {
      risks.push({
        module_id: module.module_id,
        rule: 'high_hotspot',
        evidence: { hotspot_score: module.hotspot_score, threshold: HIGH_HOTSPOT_THRESHOLD },
        severity: 'high',
      });
    }

    if (module.in_cycle) {
      risks.push({
        module_id: module.module_id,
        rule: 'circular_dependency',
        evidence: { in_cycle: true, cycle: cycleContaining(module.module_id, cycles) },
        severity: 'medium',
      });
    }
  }

  return risks.sort(
    (a, b) => a.module_id.localeCompare(b.module_id) || a.rule.localeCompare(b.rule),
  );
}
