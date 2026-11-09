import { describe, expect, it } from 'vitest';
import { evaluateQualityGate, renderSummary } from '../../src/report/render-summary';
import type { AnalysisResult, ModuleResult } from '../../src/analyze/types';

function moduleResult(id: string, hotspot: number, overrides: Partial<ModuleResult> = {}): ModuleResult {
  return {
    id,
    loc: 10,
    cyclomatic_complexity: 3,
    fan_in: 1,
    fan_out: 1,
    instability: 0.5,
    churn_commits_90d: 2,
    hotspot_score: hotspot,
    blast_radius: 1,
    in_cycle: false,
    ...overrides,
  };
}

function result(modules: ModuleResult[], extra: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    schema_version: '1.0',
    repo: { url: null, commit: '0123456789abcdef', analyzed_at: '2026-01-01T00:00:00.000Z' },
    modules,
    edges: [],
    cycles: [],
    risks: [],
    ...extra,
  };
}

describe('evaluateQualityGate', () => {
  it('passes without a threshold and reports the max score', () => {
    const gate = evaluateQualityGate(result([moduleResult('a.ts', 0.2), moduleResult('b.ts', 0.9)]), null);
    expect(gate).toEqual({ maxHotspotScore: 0.9, threshold: null, passed: true });
  });

  it('fails when the max score exceeds the threshold', () => {
    const gate = evaluateQualityGate(result([moduleResult('a.ts', 0.96)]), 0.95);
    expect(gate.passed).toBe(false);
  });

  it('treats NaN scores as 0 instead of silently skipping the gate', () => {
    const gate = evaluateQualityGate(result([moduleResult('only.ts', Number.NaN)]), 0.5);
    expect(gate).toEqual({ maxHotspotScore: 0, threshold: 0.5, passed: true });
  });

  it('handles an empty module list', () => {
    expect(evaluateQualityGate(result([]), 0.5).maxHotspotScore).toBe(0);
  });
});

describe('renderSummary', () => {
  it('ranks hotspots, lists cycles and high risks, and escapes pipes', () => {
    const analysis = result(
      [
        moduleResult('src/low.ts', 0.1),
        moduleResult('src/a|b.ts', 0.8, { in_cycle: true }),
        moduleResult('src/nan.ts', Number.NaN),
      ],
      {
        cycles: [['src/a|b.ts', 'src/low.ts']],
        risks: [
          { module_id: 'src/a|b.ts', rule: 'high_hotspot', evidence: {}, severity: 'high' },
          { module_id: 'src/low.ts', rule: 'minor', evidence: {}, severity: 'low' },
        ],
      },
    );

    const md = renderSummary(analysis, evaluateQualityGate(analysis, 0.95));

    expect(md).toContain('Commit `0123456789ab` · 3 modules · 1 cycles · 2 risks');
    expect(md).toContain('✅ passed');
    expect(md).toContain('### Top 2 hotspots');
    expect(md.indexOf('src/a\\|b.ts')).toBeLessThan(md.indexOf('`src/low.ts` | 0.100'));
    expect(md).not.toContain('src/nan.ts');
    expect(md).toContain('- `src/a\\|b.ts` → `src/low.ts`');
    expect(md).toContain('- `src/a\\|b.ts` — high_hotspot');
    expect(md).not.toContain('minor');
  });
});
