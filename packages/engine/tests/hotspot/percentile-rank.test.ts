import { describe, expect, it } from 'vitest';
import { percentileRank } from '../../src/hotspot/percentile-rank';

// See docs/adr/0004-percentile-rank-normalization-for-hotspot-fusion.md for
// the exact formula this implements and why it deliberately differs from a
// textbook percentile rank (strict count(v<x)/(n-1), ties share a score).
describe('percentileRank', () => {
  it('unique min -> 0.0, unique max -> 1.0, one outlier does not compress the rest', () => {
    expect(percentileRank([1, 2, 3, 4, 5, 200])).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });

  it('ties get the identical score (strict count-less-than, not average rank)', () => {
    expect(percentileRank([1, 1, 2, 3])).toEqual([0, 0, 2 / 3, 1]);
  });

  it('an all-equal population scores everyone 0.0, not 1.0', () => {
    expect(percentileRank([5, 5, 5])).toEqual([0, 0, 0]);
  });

  it('n=1 -> NaN (mathematically undefined, not defaulted)', () => {
    const [only] = percentileRank([42]);
    expect(Number.isNaN(only)).toBe(true);
  });

  it('n=0 -> empty array', () => {
    expect(percentileRank([])).toEqual([]);
  });
});
