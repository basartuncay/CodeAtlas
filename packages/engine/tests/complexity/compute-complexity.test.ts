import { fileURLToPath } from 'node:url';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeComplexity } from '../../src/complexity/compute-complexity';

const FIXTURES_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../fixtures');

function complexityFor(moduleId: string, results: ReturnType<typeof computeComplexity>): number {
  const found = results.find((result) => result.module_id === moduleId);
  if (!found) {
    throw new Error(`no complexity computed for ${moduleId}`);
  }
  return found.cyclomatic_complexity;
}

describe('computeComplexity — fixtures/complex-functions', () => {
  const results = computeComplexity(path.join(FIXTURES_ROOT, 'complex-functions'));

  it('returns exactly one entry per file', () => {
    expect(results).toHaveLength(4);
  });

  it('src/riskLevel.ts = 6 (if||, else-if&&, else-if)', () => {
    expect(complexityFor('src/riskLevel.ts', results)).toBe(6);
  });

  it('src/formatMessage.ts = 3 (ternary, ??)', () => {
    expect(complexityFor('src/formatMessage.ts', results)).toBe(3);
  });

  it('src/processQueue.ts = 5 (for-of, while, 2 case clauses, default not counted)', () => {
    expect(complexityFor('src/processQueue.ts', results)).toBe(5);
  });

  it('src/retryWithLogging.ts = 5 — sum of 2 functions (3 + 2), nested function not double-counted', () => {
    expect(complexityFor('src/retryWithLogging.ts', results)).toBe(5);
  });
});

describe('computeComplexity — fixtures/simple-project (low-complexity sanity check)', () => {
  const results = computeComplexity(path.join(FIXTURES_ROOT, 'simple-project'));

  it('every straight-line function is complexity 1, notificationService.ts (one if) is 2', () => {
    expect(complexityFor('src/index.ts', results)).toBe(1);
    expect(complexityFor('src/userService.ts', results)).toBe(1);
    expect(complexityFor('src/orderService.ts', results)).toBe(1);
    expect(complexityFor('src/database.ts', results)).toBe(1);
    expect(complexityFor('src/notificationService.ts', results)).toBe(2);
  });
});

describe('computeComplexity — regression: process.cwd() nested under projectRoot', () => {
  // Found while testing the dashboard. Reproduced precisely: a target
  // root containing packages/web (cwd) and packages/engine/src/a.ts (the
  // file to find), matching CodeAtlas's own layout exactly. Confirmed
  // live against the real repo (cwd=packages/web analyzing the monorepo
  // root silently dropped packages/engine, packages/web itself, and
  // packages/llm-synthesis entirely — keeping only fixtures/, which is
  // NOT nested under cwd's ancestor chain the way packages/* is).
  //
  // Root cause (best understanding, not from ts-morph's own docs): its
  // glob-based file discovery appears to treat directories along cwd's
  // own ancestor chain as "already visited" and prunes them — including
  // siblings reached by continuing to crawl a pruned ancestor — even
  // though every pattern passed in is absolute and has nothing to do
  // with cwd. A sibling-of-target cwd (not nested under it) did NOT
  // reproduce this; it specifically needs cwd nested under the target,
  // AND the target path must be realpath-equal to cwd's own ancestor
  // chain (macOS's un-realpath'd os.tmpdir() sits behind a symlink and
  // silently defeated the very first version of this repro — realpathSync
  // here is not cosmetic, it's required to actually trigger the bug).
  //
  // Fix: compute-complexity.ts chdir's into projectRoot for the duration
  // of the scan. Every prior test happened to run with a "safe" cwd/target
  // relationship (cwd equal to or an ancestor of the target, or entirely
  // unrelated), so this was never caught.
  let targetRoot: string | undefined;
  let cwdInsideTarget: string | undefined;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    targetRoot = realpathSync(mkdtempSync(path.join(tmpdir(), 'codeatlas-complexity-cwd-regression-')));
    mkdirSync(path.join(targetRoot, 'packages', 'web'), { recursive: true });
    mkdirSync(path.join(targetRoot, 'packages', 'engine', 'src'), { recursive: true });
    writeFileSync(
      path.join(targetRoot, 'packages', 'engine', 'src', 'a.ts'),
      'export function f(x: number): number {\n  if (x > 0) {\n    return x;\n  }\n  return -x;\n}\n',
    );
    cwdInsideTarget = path.join(targetRoot, 'packages', 'web');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (targetRoot) rmSync(targetRoot, { recursive: true, force: true });
  });

  it('finds a file under a sibling package when cwd is nested two levels under the target root', () => {
    process.chdir(cwdInsideTarget as string);
    const results = computeComplexity(targetRoot as string);
    expect(complexityFor('packages/engine/src/a.ts', results)).toBe(2);
  });
});
