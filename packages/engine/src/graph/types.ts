export interface DependencyEdge {
  from: string;
  to: string;
}

export interface DependencyGraph {
  modules: string[];
  edges: DependencyEdge[];
}
