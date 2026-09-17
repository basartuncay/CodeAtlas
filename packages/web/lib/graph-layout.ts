import * as dagre from 'dagre';
import type { Edge, Node } from '@xyflow/react';
import type { DependencyEdge } from '@codeatlas/engine';

export interface GraphLayoutInput {
  moduleIds: string[];
  edges: DependencyEdge[];
  cyclicModuleIds: string[];
}

export interface GraphNodeData extends Record<string, unknown> {
  label: string;
  fullId: string;
  inCycle: boolean;
}

export type GraphNode = Node<GraphNodeData>;
export type GraphEdge = Edge;

export interface GraphLayoutResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 36;

function basename(moduleId: string): string {
  const segments = moduleId.split('/');
  return segments[segments.length - 1] ?? moduleId;
}

/**
 * Pure: no React, no DOM. Converts a dependency graph into react-flow
 * node/edge objects with a dagre-computed (left-to-right, hierarchical)
 * layout. Modules that are part of a cycle get a distinct amber
 * border/fill — the visual proof that cycle detection (Adım 3) actually
 * found something, not just a number in a table.
 *
 * Edges whose endpoint isn't in `moduleIds` are dropped rather than
 * passed through to react-flow: `edges` (dependency-cruiser) and
 * `moduleIds` (ts-morph, via analyzeRepository) come from independently
 * scanned file sets that are expected to agree but aren't guaranteed to
 * — an edge react-flow can't resolve to a node throws at render time, so
 * this function is the place to be defensive about it, not the component.
 */
export function computeGraphLayout(input: GraphLayoutInput): GraphLayoutResult {
  const moduleIdSet = new Set(input.moduleIds);
  const cyclicModuleIds = new Set(input.cyclicModuleIds);
  const resolvableEdges = input.edges.filter(
    (edge) => moduleIdSet.has(edge.from) && moduleIdSet.has(edge.to),
  );

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 120 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const moduleId of input.moduleIds) {
    graph.setNode(moduleId, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of resolvableEdges) {
    graph.setEdge(edge.from, edge.to);
  }

  dagre.layout(graph);

  const nodes: GraphNode[] = input.moduleIds.map((moduleId) => {
    const { x, y } = graph.node(moduleId);
    const inCycle = cyclicModuleIds.has(moduleId);

    return {
      id: moduleId,
      position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 },
      data: { label: basename(moduleId), fullId: moduleId, inCycle },
      style: {
        width: NODE_WIDTH,
        fontSize: 11,
        fontFamily: 'monospace',
        // Explicit dark text: node backgrounds here are always light
        // (white/cream), independent of the page's own light/dark mode —
        // without this, text inherits the page's (possibly light) color
        // and washes out against these light node fills.
        color: '#171717',
        border: inCycle ? '2px solid #d97706' : '1px solid #a3a3a3',
        background: inCycle ? '#fffbeb' : '#ffffff',
      },
    };
  });

  const edges: GraphEdge[] = resolvableEdges.map((edge, index) => {
    const bothInCycle = cyclicModuleIds.has(edge.from) && cyclicModuleIds.has(edge.to);
    return {
      id: `e${index}-${edge.from}->${edge.to}`,
      source: edge.from,
      target: edge.to,
      animated: bothInCycle,
      style: bothInCycle ? { stroke: '#d97706', strokeWidth: 2 } : undefined,
    };
  });

  return { nodes, edges };
}
