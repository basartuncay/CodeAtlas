import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeChurn } from '../../src/churn/compute-churn';
import { createChurnFixtureRepo, type ChurnFixtureRepo } from '../helpers/create-churn-fixture-repo';

// See fixtures/churn-repo/EXPECTED.md for the full commit table and the
// hand-verified (and real-git-verified) reasoning behind these numbers.
let fixture: ChurnFixtureRepo;

beforeEach(() => {
  fixture = createChurnFixtureRepo();
});

afterEach(() => {
  fixture.cleanup();
});

describe('computeChurn — 90-day window ending 2024-01-01T00:00:00Z (fixed asOf)', () => {
  it('counts fileA.ts=3, fileB.ts=2, fileC.ts=2, and nothing else', async () => {
    const results = await computeChurn(fixture.repoPath, {
      asOf: new Date('2024-01-01T00:00:00Z'),
      windowDays: 90,
    });

    expect(results).toEqual([
      { module_id: 'fileA.ts', churn_commits: 3 },
      { module_id: 'fileB.ts', churn_commits: 2 },
      { module_id: 'fileC.ts', churn_commits: 2 },
    ]);
  });

  it('excludes the too-old commit (2023-09-01) and the future commit (2024-01-15)', async () => {
    const results = await computeChurn(fixture.repoPath, {
      asOf: new Date('2024-01-01T00:00:00Z'),
      windowDays: 90,
    });
    const total = results.reduce((sum, r) => sum + r.churn_commits, 0);
    // 6 in-window commits, one of which (#4) touches 2 files -> sum is 7,
    // not 6. See EXPECTED.md's "Sağlama" section.
    expect(total).toBe(7);
  });
});

describe('computeChurn — asOf is injected, not read from the real clock', () => {
  it('a different fixed asOf produces a different, still-deterministic window', async () => {
    // window = [2023-07-05T00:00:00Z, 2023-10-03T00:00:00Z]: only commits
    // #1 (2023-09-01, fileA+fileB) and #2 (2023-10-03, fileB, on the
    // until boundary) fall inside it.
    const results = await computeChurn(fixture.repoPath, {
      asOf: new Date('2023-10-03T00:00:00Z'),
      windowDays: 90,
    });

    expect(results).toEqual([
      { module_id: 'fileA.ts', churn_commits: 1 },
      { module_id: 'fileB.ts', churn_commits: 2 },
    ]);
  });

  it('returns an empty array when the window contains no commits', async () => {
    const results = await computeChurn(fixture.repoPath, {
      asOf: new Date('2020-01-01T00:00:00Z'),
      windowDays: 30,
    });

    expect(results).toEqual([]);
  });
});

describe('computeChurn — repoPath is a subdirectory of the git repo', () => {
  it('reports paths relative to repoPath and ignores files outside it', async () => {
    const { execFileSync } = await import('node:child_process');
    const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const path = await import('node:path');

    const root = mkdtempSync(path.join(tmpdir(), 'codeatlas-churn-subdir-'));
    try {
      const env = {
        ...process.env,
        GIT_AUTHOR_DATE: '2023-12-01T00:00:00Z',
        GIT_COMMITTER_DATE: '2023-12-01T00:00:00Z',
      };
      const git = (...args: string[]) =>
        execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root, env });
      git('init', '-q');
      mkdirSync(path.join(root, 'pkg'));
      writeFileSync(path.join(root, 'pkg', 'inner.ts'), 'export {};\n');
      writeFileSync(path.join(root, 'outer.ts'), 'export {};\n');
      git('add', '.');
      git('commit', '-q', '-m', 'init');

      const results = await computeChurn(path.join(root, 'pkg'), {
        asOf: new Date('2024-01-01T00:00:00Z'),
        windowDays: 90,
      });

      expect(results).toEqual([{ module_id: 'inner.ts', churn_commits: 1 }]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
