import type { DependencyGraph } from '../../src/graph/types';

// Mirrors fixtures/cyclic-project/EXPECTED.md exactly. Type-only imports
// (server.ts -> tokenStore.ts, sessionManager.ts -> tokenStore.ts) are
// deliberately excluded — see
// docs/adr/0002-type-only-imports-excluded-from-graph.md.
export const CYCLIC_PROJECT_GRAPH: DependencyGraph = {
  modules: [
    'src/server.ts',
    'src/sessionManager.ts',
    'src/authService.ts',
    'src/tokenStore.ts',
    'src/logger.ts',
  ],
  edges: [
    { from: 'src/server.ts', to: 'src/sessionManager.ts' },
    { from: 'src/sessionManager.ts', to: 'src/authService.ts' },
    { from: 'src/authService.ts', to: 'src/tokenStore.ts' },
    { from: 'src/authService.ts', to: 'src/logger.ts' },
    { from: 'src/tokenStore.ts', to: 'src/sessionManager.ts' },
  ],
};

// Mirrors fixtures/simple-project/EXPECTED.md exactly — a DAG, no cycles.
export const SIMPLE_PROJECT_GRAPH: DependencyGraph = {
  modules: [
    'src/index.ts',
    'src/userService.ts',
    'src/orderService.ts',
    'src/database.ts',
    'src/notificationService.ts',
  ],
  edges: [
    { from: 'src/index.ts', to: 'src/userService.ts' },
    { from: 'src/index.ts', to: 'src/orderService.ts' },
    { from: 'src/userService.ts', to: 'src/database.ts' },
    { from: 'src/orderService.ts', to: 'src/database.ts' },
    { from: 'src/notificationService.ts', to: 'src/userService.ts' },
  ],
};
