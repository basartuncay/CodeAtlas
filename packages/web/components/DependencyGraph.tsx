"use client";

import { useMemo, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Background, Controls, ReactFlow, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { DependencyEdge } from "@codeatlas/engine";
import { computeGraphLayout, type GraphNodeData } from "@/lib/graph-layout";

export function DependencyGraph({
  moduleIds,
  edges,
  cyclicModuleIds,
}: {
  moduleIds: string[];
  edges: DependencyEdge[];
  cyclicModuleIds: string[];
}) {
  const router = useRouter();

  const { nodes, edges: flowEdges } = useMemo(
    () => computeGraphLayout({ moduleIds, edges, cyclicModuleIds }),
    [moduleIds, edges, cyclicModuleIds],
  );

  function handleNodeClick(_event: MouseEvent, node: Node<GraphNodeData>) {
    router.push(`/module/${node.data.fullId}`);
  }

  return (
    <div style={{ height: 480 }} className="rounded border border-neutral-200">
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        onNodeClick={handleNodeClick}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
