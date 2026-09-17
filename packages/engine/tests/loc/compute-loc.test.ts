import { fileURLToPath } from 'node:url';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeLoc } from '../../src/loc/compute-loc';

// fixtures/complex-functions/EXPECTED.md — LOC section: getEndLineNumber()
// is always exactly `wc -l` + 1 (verified empirically, not assumed), for
// every one of these four files.
const FIXTURE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../fixtures/complex-functions',
);

function locFor(moduleId: string, results: ReturnType<typeof computeLoc>): number {
  const found = results.find((r) => r.module_id === moduleId);
  if (!found) {
    throw new Error(`no LOC computed for ${moduleId}`);
  }
  return found.loc;
}

describe('computeLoc — fixtures/complex-functions', () => {
  const results = computeLoc(FIXTURE_ROOT);

  it('returns exactly one entry per file', () => {
    expect(results).toHaveLength(4);
  });

  it('src/formatMessage.ts: wc -l=5 -> loc=6', () => {
    expect(locFor('src/formatMessage.ts', results)).toBe(6);
  });

  it('src/processQueue.ts: wc -l=20 -> loc=21', () => {
    expect(locFor('src/processQueue.ts', results)).toBe(21);
  });

  it('src/retryWithLogging.ts: wc -l=16 -> loc=17', () => {
    expect(locFor('src/retryWithLogging.ts', results)).toBe(17);
  });

  it('src/riskLevel.ts: wc -l=10 -> loc=11', () => {
    expect(locFor('src/riskLevel.ts', results)).toBe(11);
  });
});

describe('computeLoc — regression: process.cwd() nested under projectRoot', () => {
  // Same underlying ts-morph bug as computeComplexity's identical
  // regression test — see that file's comment for the full explanation
  // and how this exact repro shape (cwd = <root>/packages/web,
  // realpath-normalized target root, file under a sibling package) was
  // arrived at. computeLoc uses the same Project.addSourceFilesAtPaths
  // call, so it has the identical bug and the identical fix.
  let targetRoot: string | undefined;
  let cwdInsideTarget: string | undefined;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    targetRoot = realpathSync(mkdtempSync(path.join(tmpdir(), 'codeatlas-loc-cwd-regression-')));
    mkdirSync(path.join(targetRoot, 'packages', 'web'), { recursive: true });
    mkdirSync(path.join(targetRoot, 'packages', 'engine', 'src'), { recursive: true });
    writeFileSync(path.join(targetRoot, 'packages', 'engine', 'src', 'a.ts'), 'export const a = 1;\n');
    cwdInsideTarget = path.join(targetRoot, 'packages', 'web');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (targetRoot) rmSync(targetRoot, { recursive: true, force: true });
  });

  it('finds a file under a sibling package when cwd is nested two levels under the target root', () => {
    process.chdir(cwdInsideTarget as string);
    const results = computeLoc(targetRoot as string);
    expect(locFor('packages/engine/src/a.ts', results)).toBe(2);
  });
});
