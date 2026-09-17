import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildDependencyGraph } from '../../src/graph/build-dependency-graph';

// fixtures/simple-project — see EXPECTED.md for the hand-computed graph this
// fixture is designed to produce: a DAG with one branch (index.ts -> two
// files) and one convergence (database.ts <- two files), no cycles.
const FIXTURE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../fixtures/simple-project',
);

describe('buildDependencyGraph', () => {
  it('discovers every module in the fixture project', async () => {
    const graph = await buildDependencyGraph(FIXTURE_ROOT);

    expect([...graph.modules].sort()).toEqual([
      'src/database.ts',
      'src/index.ts',
      'src/notificationService.ts',
      'src/orderService.ts',
      'src/userService.ts',
    ]);
  });

  it('extracts exactly the edges declared by the fixture imports', async () => {
    const graph = await buildDependencyGraph(FIXTURE_ROOT);

    const edgeStrings = graph.edges.map((edge) => `${edge.from} -> ${edge.to}`).sort();

    expect(edgeStrings).toEqual(
      [
        'src/index.ts -> src/orderService.ts',
        'src/index.ts -> src/userService.ts',
        'src/notificationService.ts -> src/userService.ts',
        'src/orderService.ts -> src/database.ts',
        'src/userService.ts -> src/database.ts',
      ].sort(),
    );
  });
});
