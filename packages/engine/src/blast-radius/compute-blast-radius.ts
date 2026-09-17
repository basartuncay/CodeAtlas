import type { DependencyGraph } from '../graph/types';
import type { BlastRadiusResult } from './types';

/**
 * dependents[X] = set of modules that import X directly — i.e. the reverse
 * of the dependency graph's edges.
 */
function buildDependents(graph: DependencyGraph): Map<string, string[]> {
  const dependents = new Map<string, string[]>();
  for (const moduleId of graph.modules) {
    dependents.set(moduleId, []);
  }
  for (const edge of graph.edges) {
    dependents.get(edge.to)?.push(edge.from);
  }
  return dependents;
}

/**
 * BFS over the dependents relation starting at `start`, counting every
 * module transitively reachable — i.e. every module that would be
 * affected if `start`'s behavior changed. Excludes `start` itself.
 */
function countTransitiveDependents(start: string, dependents: Map<string, string[]>): number {
  const visited = new Set<string>([start]);
  const queue: string[] = [start];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const dependent of dependents.get(current) ?? []) {
      if (!visited.has(dependent)) {
        visited.add(dependent);
        queue.push(dependent);
      }
    }
  }

  return visited.size - 1;
}

export function computeBlastRadius(graph: DependencyGraph): BlastRadiusResult[] {
  const dependents = buildDependents(graph);

  return graph.modules.map((moduleId) => ({
    module_id: moduleId,
    blast_radius: countTransitiveDependents(moduleId, dependents),
  }));
}
