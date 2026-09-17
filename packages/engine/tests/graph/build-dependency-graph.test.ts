import { describe, expect, it, afterEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

describe('buildDependencyGraph — regression: project root under a symlinked temp dir', () => {
  // On macOS, os.tmpdir() lives under /var, which is itself a symlink to
  // /private/var. Passing that non-realpath'd path straight through to
  // dependency-cruiser as baseDir made it resolve circular imports'
  // targets via realpath while the initial file-scan used the given
  // (non-realpath'd) path — the same file then showed up TWICE, once
  // under each path convention, as if they were two different modules.
  // This never surfaced before because every prior fixture lived directly
  // under this repo's own (non-symlinked) path. Reproduced with a 2-file
  // cycle, since the bug only manifested when resolving an import back to
  // an already-discovered file.
  let tempRoot: string | undefined;

  afterEach(() => {
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = undefined;
    }
  });

  it('does not duplicate modules when the root is reached through a symlink', async () => {
    tempRoot = mkdtempSync(path.join(tmpdir(), 'codeatlas-symlink-regression-'));
    const srcDir = path.join(tempRoot, 'src');
    mkdirSync(srcDir);
    writeFileSync(
      path.join(srcDir, 'cache.ts'),
      "import { save } from './store';\nexport function put(): void { save(); }\n",
    );
    writeFileSync(
      path.join(srcDir, 'store.ts'),
      "import { put } from './cache';\nexport function save(): void { put(); }\n",
    );

    const graph = await buildDependencyGraph(tempRoot);

    expect([...graph.modules].sort()).toEqual(['src/cache.ts', 'src/store.ts']);
    expect(graph.edges.map((edge) => `${edge.from} -> ${edge.to}`).sort()).toEqual([
      'src/cache.ts -> src/store.ts',
      'src/store.ts -> src/cache.ts',
    ]);
  });
});
