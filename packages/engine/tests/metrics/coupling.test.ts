import { describe, expect, it } from 'vitest';
import { computeCouplingMetrics } from '../../src/metrics/coupling';
import type { DependencyGraph } from '../../src/graph/types';
import type { CouplingMetrics } from '../../src/metrics/types';

// Mirrors fixtures/simple-project/EXPECTED.md exactly — this is a pure unit
// test of the instability formula, independent of dependency-cruiser/I/O.
const FIXTURE_GRAPH: DependencyGraph = {
  modules: [
    'src/index.ts',
    'src/userService.ts',
    'src/orderService.ts',
    'src/database.ts',
    'src/notificationService.ts',
  ],
  edges: [
    { from: 'src/index.ts', to: 'src/userService.ts' },
    { from: 'src/index.ts', to: 'src/orderService.ts' },
    { from: 'src/userService.ts', to: 'src/database.ts' },
    { from: 'src/orderService.ts', to: 'src/database.ts' },
    { from: 'src/notificationService.ts', to: 'src/userService.ts' },
  ],
};

function metricsFor(moduleId: string, metrics: CouplingMetrics[]): CouplingMetrics {
  const found = metrics.find((metric) => metric.module_id === moduleId);
  if (!found) {
    throw new Error(`no metrics computed for ${moduleId}`);
  }
  return found;
}

describe('computeCouplingMetrics', () => {
  const metrics = computeCouplingMetrics(FIXTURE_GRAPH);

  it('returns exactly one entry per module', () => {
    expect(metrics).toHaveLength(5);
  });

  it('src/index.ts: fan_out=2 (userService, orderService), fan_in=0, instability=1.0', () => {
    const m = metricsFor('src/index.ts', metrics);
    expect(m.fan_out).toBe(2);
    expect(m.fan_in).toBe(0);
    expect(m.instability).toBeCloseTo(1.0, 5);
  });

  it('src/userService.ts: fan_out=1 (database), fan_in=2 (index, notificationService), instability=0.333', () => {
    const m = metricsFor('src/userService.ts', metrics);
    expect(m.fan_out).toBe(1);
    expect(m.fan_in).toBe(2);
    expect(m.instability).toBeCloseTo(1 / 3, 5);
  });

  it('src/orderService.ts: fan_out=1 (database), fan_in=1 (index), instability=0.5', () => {
    const m = metricsFor('src/orderService.ts', metrics);
    expect(m.fan_out).toBe(1);
    expect(m.fan_in).toBe(1);
    expect(m.instability).toBeCloseTo(0.5, 5);
  });

  it('src/database.ts: fan_out=0 (leaf), fan_in=2 (userService, orderService), instability=0.0', () => {
    const m = metricsFor('src/database.ts', metrics);
    expect(m.fan_out).toBe(0);
    expect(m.fan_in).toBe(2);
    expect(m.instability).toBeCloseTo(0.0, 5);
  });

  it('src/notificationService.ts: fan_out=1 (userService), fan_in=0, instability=1.0', () => {
    const m = metricsFor('src/notificationService.ts', metrics);
    expect(m.fan_out).toBe(1);
    expect(m.fan_in).toBe(0);
    expect(m.instability).toBeCloseTo(1.0, 5);
  });
});

describe('computeCouplingMetrics — isolated module', () => {
  // A module with no imports and no importers: fan_in=0, fan_out=0.
  // I = Ce / (Ca + Ce) = 0 / 0 = NaN — genuinely undefined, not defaulted
  // to 0 or 1. See docs/adr/0001-instability-nan-for-isolated-modules.md.
  const ISOLATED_GRAPH: DependencyGraph = {
    modules: ['src/standalone.ts'],
    edges: [],
  };

  it('reports fan_in=0, fan_out=0, and instability=NaN (undefined, not defaulted)', () => {
    const metrics = computeCouplingMetrics(ISOLATED_GRAPH);
    const m = metricsFor('src/standalone.ts', metrics);
    expect(m.fan_out).toBe(0);
    expect(m.fan_in).toBe(0);
    expect(Number.isNaN(m.instability)).toBe(true);
  });
});
