import { describe, expect, it } from 'vitest';
import { computeBlastRadius } from '../../src/blast-radius/compute-blast-radius';
import type { BlastRadiusResult } from '../../src/blast-radius/types';
import { CYCLIC_PROJECT_GRAPH } from '../fixtures/graphs';

function blastRadiusFor(moduleId: string, results: BlastRadiusResult[]): number {
  const found = results.find((result) => result.module_id === moduleId);
  if (!found) {
    throw new Error(`no blast radius computed for ${moduleId}`);
  }
  return found.blast_radius;
}

describe('computeBlastRadius — fixtures/cyclic-project', () => {
  const results = computeBlastRadius(CYCLIC_PROJECT_GRAPH);

  it('returns exactly one entry per module', () => {
    expect(results).toHaveLength(5);
  });

  it('server.ts: blast_radius=0 (nothing depends on it)', () => {
    expect(blastRadiusFor('src/server.ts', results)).toBe(0);
  });

  it('sessionManager.ts: blast_radius=3 (server, tokenStore, authService)', () => {
    expect(blastRadiusFor('src/sessionManager.ts', results)).toBe(3);
  });

  it('authService.ts: blast_radius=3 (sessionManager, server, tokenStore)', () => {
    expect(blastRadiusFor('src/authService.ts', results)).toBe(3);
  });

  it('tokenStore.ts: blast_radius=3 (authService, sessionManager, server)', () => {
    expect(blastRadiusFor('src/tokenStore.ts', results)).toBe(3);
  });

  it('logger.ts: blast_radius=4 (everything transitively depends on the leaf)', () => {
    expect(blastRadiusFor('src/logger.ts', results)).toBe(4);
  });
});
