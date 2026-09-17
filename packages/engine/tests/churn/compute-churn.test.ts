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
