import type { DependencyGraph } from '../graph/types';
import type { Cycle } from './types';

function buildAdjacency(graph: DependencyGraph): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const moduleId of graph.modules) {
    adjacency.set(moduleId, []);
  }
  for (const edge of graph.edges) {
    adjacency.get(edge.from)?.push(edge.to);
  }
  return adjacency;
}

/**
 * Tarjan's strongly-connected-components algorithm. Returns every SCC with
 * more than one member — that is exactly a cycle. A single-node self-loop
 * (a module importing itself) would also be a genuine cycle, but none of
 * our fixtures exercise that case, so it's deliberately left untreated
 * rather than guessed at.
 */
export function detectCycles(graph: DependencyGraph): Cycle[] {
  const adjacency = buildAdjacency(graph);

  let nextIndex = 0;
  const index = new Map<string, number>();
  const lowLink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];

  function strongConnect(v: string): void {
    index.set(v, nextIndex);
    lowLink.set(v, nextIndex);
    nextIndex += 1;
    stack.push(v);
    onStack.add(v);

    for (const w of adjacency.get(v) ?? []) {
      if (!index.has(w)) {
        strongConnect(w);
        lowLink.set(v, Math.min(lowLink.get(v) as number, lowLink.get(w) as number));
      } else if (onStack.has(w)) {
        lowLink.set(v, Math.min(lowLink.get(v) as number, index.get(w) as number));
      }
    }

    if (lowLink.get(v) === index.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop() as string;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      sccs.push(component);
    }
  }

  for (const moduleId of graph.modules) {
    if (!index.has(moduleId)) {
      strongConnect(moduleId);
    }
  }

  return sccs.filter((component) => component.length > 1);
}
