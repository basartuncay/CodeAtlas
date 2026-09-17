import { describe, expect, it } from 'vitest';
import { computeHotspotScore } from '../../src/hotspot/compute-hotspot';
import type { ComplexityResult } from '../../src/complexity/types';
import type { ChurnResult } from '../../src/churn/types';

// Mirrors fixtures/complex-functions/EXPECTED.md's "Hotspot fusion" section.
// Complexity numbers are real (ts-morph-verified separately). Churn numbers
// here are synthetic — hand-chosen to exercise the fusion math, not derived
// from a real git repo (that's covered separately by fixtures/churn-repo).
const COMPLEXITY: ComplexityResult[] = [
  { module_id: 'src/riskLevel.ts', cyclomatic_complexity: 6 },
  { module_id: 'src/formatMessage.ts', cyclomatic_complexity: 3 },
  { module_id: 'src/processQueue.ts', cyclomatic_complexity: 5 },
  { module_id: 'src/retryWithLogging.ts', cyclomatic_complexity: 5 },
];

const CHURN: ChurnResult[] = [
  { module_id: 'src/riskLevel.ts', churn_commits: 8 },
  { module_id: 'src/formatMessage.ts', churn_commits: 1 },
  { module_id: 'src/processQueue.ts', churn_commits: 1 },
  // src/retryWithLogging.ts deliberately absent -> must default to churn=0
  { module_id: 'src/deletedLegacy.ts', churn_commits: 15 }, // ghost: no complexity entry
];

function resultFor(
  moduleId: string,
  results: ReturnType<typeof computeHotspotScore>,
): ReturnType<typeof computeHotspotScore>[number] {
  const found = results.find((r) => r.module_id === moduleId);
  if (!found) {
    throw new Error(`no hotspot result for ${moduleId}`);
  }
  return found;
}

describe('computeHotspotScore — fixtures/complex-functions + synthetic churn', () => {
  const results = computeHotspotScore(COMPLEXITY, CHURN);

  it('returns exactly 4 entries — the ghost file (deletedLegacy.ts) is dropped', () => {
    expect(results).toHaveLength(4);
    expect(results.some((r) => r.module_id === 'src/deletedLegacy.ts')).toBe(false);
  });

  it('src/riskLevel.ts: highest complexity AND highest churn -> hotspot_score=1.0', () => {
    const r = resultFor('src/riskLevel.ts', results);
    expect(r.normalized_complexity).toBeCloseTo(1.0, 5);
    expect(r.normalized_churn).toBeCloseTo(1.0, 5);
    expect(r.hotspot_score).toBeCloseTo(1.0, 5);
  });

  it('src/formatMessage.ts: lowest complexity -> hotspot_score=0.0 regardless of its churn', () => {
    const r = resultFor('src/formatMessage.ts', results);
    expect(r.normalized_complexity).toBeCloseTo(0.0, 5);
    expect(r.hotspot_score).toBeCloseTo(0.0, 5);
  });

  it('src/processQueue.ts: mid complexity, mid churn -> hotspot_score≈1/9', () => {
    const r = resultFor('src/processQueue.ts', results);
    expect(r.normalized_complexity).toBeCloseTo(1 / 3, 5);
    expect(r.normalized_churn).toBeCloseTo(1 / 3, 5);
    expect(r.hotspot_score).toBeCloseTo(1 / 9, 5);
  });

  it('src/retryWithLogging.ts: absent from churn input -> defaults to churn=0, hotspot_score=0.0', () => {
    const r = resultFor('src/retryWithLogging.ts', results);
    expect(r.normalized_complexity).toBeCloseTo(1 / 3, 5);
    expect(r.normalized_churn).toBeCloseTo(0.0, 5);
    expect(r.hotspot_score).toBeCloseTo(0.0, 5);
  });
});

describe('computeHotspotScore — edge cases', () => {
  it('n=1: the single module gets NaN everywhere (undefined, not defaulted)', () => {
    const results = computeHotspotScore(
      [{ module_id: 'only.ts', cyclomatic_complexity: 10 }],
      [{ module_id: 'only.ts', churn_commits: 5 }],
    );
    expect(results).toHaveLength(1);
    expect(Number.isNaN(results[0].normalized_complexity)).toBe(true);
    expect(Number.isNaN(results[0].normalized_churn)).toBe(true);
    expect(Number.isNaN(results[0].hotspot_score)).toBe(true);
  });

  it('all-equal complexity across modules -> normalized_complexity=0.0 for everyone, not 1.0', () => {
    const results = computeHotspotScore(
      [
        { module_id: 'a.ts', cyclomatic_complexity: 5 },
        { module_id: 'b.ts', cyclomatic_complexity: 5 },
        { module_id: 'c.ts', cyclomatic_complexity: 5 },
      ],
      [
        { module_id: 'a.ts', churn_commits: 1 },
        { module_id: 'b.ts', churn_commits: 5 },
        { module_id: 'c.ts', churn_commits: 10 },
      ],
    );
    for (const r of results) {
      expect(r.normalized_complexity).toBe(0);
      expect(r.hotspot_score).toBe(0);
    }
  });

  it('a module in churn but not in complexity is dropped and does not pollute normalization', () => {
    const results = computeHotspotScore(
      [
        { module_id: 'exists1.ts', cyclomatic_complexity: 3 },
        { module_id: 'exists2.ts', cyclomatic_complexity: 5 },
      ],
      [
        { module_id: 'exists1.ts', churn_commits: 2 },
        { module_id: 'exists2.ts', churn_commits: 4 },
        { module_id: 'deleted.ts', churn_commits: 999 },
      ],
    );

    expect(results).toHaveLength(2);
    expect(results.some((r) => r.module_id === 'deleted.ts')).toBe(false);

    // If the 999-commit ghost had polluted the churn population, both real
    // modules would normalize near 0 instead of spanning [0, 1].
    expect(resultFor('exists1.ts', results).normalized_churn).toBeCloseTo(0, 5);
    expect(resultFor('exists2.ts', results).normalized_churn).toBeCloseTo(1, 5);
  });
});
