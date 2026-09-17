import type { ChurnResult } from '../churn/types';
import type { ComplexityResult } from '../complexity/types';
import { percentileRank } from './percentile-rank';
import type { HotspotResult } from './types';

/**
 * Module set is authoritative from `complexity` (i.e. files that
 * currently exist). A module in `churn` but not in `complexity` (deleted
 * or renamed since) is dropped entirely — not in the output, and not part
 * of the churn normalization population either. A module in `complexity`
 * but absent from `churn` gets churn_commits=0 (a real, well-defined
 * value: zero commits touched it in the analyzed window). See ADR 0004.
 */
export function computeHotspotScore(
  complexity: ComplexityResult[],
  churn: ChurnResult[],
): HotspotResult[] {
  const churnByModule = new Map(churn.map((entry) => [entry.module_id, entry.churn_commits]));

  const complexityValues = complexity.map((entry) => entry.cyclomatic_complexity);
  const churnValues = complexity.map((entry) => churnByModule.get(entry.module_id) ?? 0);

  const normalizedComplexity = percentileRank(complexityValues);
  const normalizedChurn = percentileRank(churnValues);

  return complexity.map((entry, index) => ({
    module_id: entry.module_id,
    normalized_complexity: normalizedComplexity[index],
    normalized_churn: normalizedChurn[index],
    hotspot_score: normalizedComplexity[index] * normalizedChurn[index],
  }));
}
