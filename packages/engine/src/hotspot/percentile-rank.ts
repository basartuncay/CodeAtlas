/**
 * normalized(x) = |{ v in values : v < x }| / (n - 1), for n > 1; NaN for
 * n <= 1. A deliberate variant of textbook percentile rank — see
 * docs/adr/0004-percentile-rank-normalization-for-hotspot-fusion.md for
 * why (anchors a unique min/max to exactly 0/1, ties share one score).
 */
export function percentileRank(values: number[]): number[] {
  const n = values.length;

  if (n <= 1) {
    return values.map(() => NaN);
  }

  return values.map((x) => values.filter((v) => v < x).length / (n - 1));
}
