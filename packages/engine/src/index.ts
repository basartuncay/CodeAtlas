export { buildDependencyGraph } from './graph/build-dependency-graph';
export type { DependencyEdge, DependencyGraph } from './graph/types';

export { computeCouplingMetrics } from './metrics/coupling';
export type { CouplingMetrics } from './metrics/types';

export { detectCycles } from './cycles/detect-cycles';
export { cycleMembership } from './cycles/cycle-membership';
export type { Cycle, CycleMembership } from './cycles/types';

export { computeBlastRadius } from './blast-radius/compute-blast-radius';
export type { BlastRadiusResult } from './blast-radius/types';

export { computeChurn } from './churn/compute-churn';
export type { ChurnResult, ChurnWindow } from './churn/types';

export { computeComplexity } from './complexity/compute-complexity';
export type { ComplexityResult } from './complexity/types';
