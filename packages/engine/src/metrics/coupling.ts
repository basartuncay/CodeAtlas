import type { DependencyGraph } from '../graph/types';
import type { CouplingMetrics } from './types';

/**
 * I = Ce / (Ca + Ce) — Robert C. Martin's instability metric.
 * Ce (efferent coupling) = fan_out, Ca (afferent coupling) = fan_in.
 * Undefined (NaN) for a module with zero fan_in and zero fan_out
 * (an isolated module) — that is a real "undefined", not defaulted away.
 */
function instability(fanIn: number, fanOut: number): number {
  return fanOut / (fanIn + fanOut);
}

export function computeCouplingMetrics(graph: DependencyGraph): CouplingMetrics[] {
  const fanOutByModule = new Map<string, number>();
  const fanInByModule = new Map<string, number>();

  for (const module of graph.modules) {
    fanOutByModule.set(module, 0);
    fanInByModule.set(module, 0);
  }

  for (const edge of graph.edges) {
    fanOutByModule.set(edge.from, (fanOutByModule.get(edge.from) ?? 0) + 1);
    fanInByModule.set(edge.to, (fanInByModule.get(edge.to) ?? 0) + 1);
  }

  return graph.modules.map((moduleId) => {
    const fanOut = fanOutByModule.get(moduleId) ?? 0;
    const fanIn = fanInByModule.get(moduleId) ?? 0;
    return {
      module_id: moduleId,
      fan_in: fanIn,
      fan_out: fanOut,
      instability: instability(fanIn, fanOut),
    };
  });
}
