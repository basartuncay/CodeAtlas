import { describe, expect, it } from 'vitest';
import { detectCycles } from '../../src/cycles/detect-cycles';
import { cycleMembership } from '../../src/cycles/cycle-membership';
import { CYCLIC_PROJECT_GRAPH, SIMPLE_PROJECT_GRAPH } from '../fixtures/graphs';

describe('detectCycles — fixtures/cyclic-project (positive case)', () => {
  it('finds exactly one SCC: {sessionManager, authService, tokenStore}', () => {
    const cycles = detectCycles(CYCLIC_PROJECT_GRAPH);
    expect(cycles).toHaveLength(1);
    expect([...cycles[0]].sort()).toEqual(
      ['src/authService.ts', 'src/sessionManager.ts', 'src/tokenStore.ts'].sort(),
    );
  });

  it('does not include server.ts or logger.ts in any cycle', () => {
    const cycles = detectCycles(CYCLIC_PROJECT_GRAPH);
    const allCycleMembers = new Set(cycles.flat());
    expect(allCycleMembers.has('src/server.ts')).toBe(false);
    expect(allCycleMembers.has('src/logger.ts')).toBe(false);
  });

  it("matches EXPECTED.md's in_cycle table exactly, via cycleMembership", () => {
    const cycles = detectCycles(CYCLIC_PROJECT_GRAPH);
    const inCycle = cycleMembership(CYCLIC_PROJECT_GRAPH.modules, cycles);

    expect(inCycle).toEqual({
      'src/server.ts': false,
      'src/sessionManager.ts': true,
      'src/authService.ts': true,
      'src/tokenStore.ts': true,
      'src/logger.ts': false,
    });
  });
});

describe('detectCycles — fixtures/simple-project (negative control, no cycles)', () => {
  it('finds zero cycles — simple-project is a DAG', () => {
    expect(detectCycles(SIMPLE_PROJECT_GRAPH)).toEqual([]);
  });

  it('reports in_cycle=false for every module', () => {
    const inCycle = cycleMembership(
      SIMPLE_PROJECT_GRAPH.modules,
      detectCycles(SIMPLE_PROJECT_GRAPH),
    );
    expect(Object.keys(inCycle)).toHaveLength(5);
    expect(Object.values(inCycle).every((value) => value === false)).toBe(true);
  });
});
