import { describe, expect, it } from 'vitest';
import { computeRisks } from '../../src/risks/compute-risks';

describe('computeRisks — high_hotspot', () => {
  it("flags high_hotspot when hotspot_score exceeds 0.7 (PLAN.md's own example: 0.81)", () => {
    const risks = computeRisks(
      [{ module_id: 'src/services/PaymentService.ts', hotspot_score: 0.81, in_cycle: false }],
      [],
    );

    expect(risks).toEqual([
      {
        module_id: 'src/services/PaymentService.ts',
        rule: 'high_hotspot',
        evidence: { hotspot_score: 0.81, threshold: 0.7 },
        severity: 'high',
      },
    ]);
  });

  it('does not flag high_hotspot at exactly the threshold (strictly greater than, not >=)', () => {
    const risks = computeRisks([{ module_id: 'a.ts', hotspot_score: 0.7, in_cycle: false }], []);
    expect(risks).toEqual([]);
  });

  it('does not flag high_hotspot for a NaN hotspot_score (undefined, never elevated)', () => {
    const risks = computeRisks([{ module_id: 'a.ts', hotspot_score: NaN, in_cycle: false }], []);
    expect(risks).toEqual([]);
  });
});

describe('computeRisks — circular_dependency', () => {
  it('flags circular_dependency for an in_cycle module, with the cycle as evidence', () => {
    const risks = computeRisks(
      [{ module_id: 'a.ts', hotspot_score: 0, in_cycle: true }],
      [['a.ts', 'b.ts']],
    );

    expect(risks).toEqual([
      {
        module_id: 'a.ts',
        rule: 'circular_dependency',
        evidence: { in_cycle: true, cycle: ['a.ts', 'b.ts'] },
        severity: 'medium',
      },
    ]);
  });

  it('does not flag a module that is not in any cycle', () => {
    const risks = computeRisks([{ module_id: 'a.ts', hotspot_score: 0, in_cycle: false }], []);
    expect(risks).toEqual([]);
  });
});

describe('computeRisks — combined', () => {
  it('a module can trigger both rules at once', () => {
    const risks = computeRisks(
      [{ module_id: 'a.ts', hotspot_score: 0.9, in_cycle: true }],
      [['a.ts', 'b.ts']],
    );

    expect(risks).toHaveLength(2);
    expect(risks.map((r) => r.rule).sort()).toEqual(['circular_dependency', 'high_hotspot']);
  });

  it('fixtures/golden-repo: only circular_dependency fires (cache.ts, store.ts) — no high_hotspot (max 0.6 < 0.7)', () => {
    const risks = computeRisks(
      [
        { module_id: 'src/cache.ts', hotspot_score: 0.6, in_cycle: true },
        { module_id: 'src/config.ts', hotspot_score: 0.0, in_cycle: false },
        { module_id: 'src/logger.ts', hotspot_score: 0.0, in_cycle: false },
        { module_id: 'src/main.ts', hotspot_score: 0.08, in_cycle: false },
        { module_id: 'src/standalone.ts', hotspot_score: 0.0, in_cycle: false },
        { module_id: 'src/store.ts', hotspot_score: 0.24, in_cycle: true },
      ],
      [['src/cache.ts', 'src/store.ts']],
    );

    expect(risks).toEqual([
      {
        module_id: 'src/cache.ts',
        rule: 'circular_dependency',
        evidence: { in_cycle: true, cycle: ['src/cache.ts', 'src/store.ts'] },
        severity: 'medium',
      },
      {
        module_id: 'src/store.ts',
        rule: 'circular_dependency',
        evidence: { in_cycle: true, cycle: ['src/cache.ts', 'src/store.ts'] },
        severity: 'medium',
      },
    ]);
  });
});
