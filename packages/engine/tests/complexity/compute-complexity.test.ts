import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeComplexity } from '../../src/complexity/compute-complexity';

const FIXTURES_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../fixtures');

function complexityFor(moduleId: string, results: ReturnType<typeof computeComplexity>): number {
  const found = results.find((result) => result.module_id === moduleId);
  if (!found) {
    throw new Error(`no complexity computed for ${moduleId}`);
  }
  return found.cyclomatic_complexity;
}

describe('computeComplexity — fixtures/complex-functions', () => {
  const results = computeComplexity(path.join(FIXTURES_ROOT, 'complex-functions'));

  it('returns exactly one entry per file', () => {
    expect(results).toHaveLength(4);
  });

  it('src/riskLevel.ts = 6 (if||, else-if&&, else-if)', () => {
    expect(complexityFor('src/riskLevel.ts', results)).toBe(6);
  });

  it('src/formatMessage.ts = 3 (ternary, ??)', () => {
    expect(complexityFor('src/formatMessage.ts', results)).toBe(3);
  });

  it('src/processQueue.ts = 5 (for-of, while, 2 case clauses, default not counted)', () => {
    expect(complexityFor('src/processQueue.ts', results)).toBe(5);
  });

  it('src/retryWithLogging.ts = 5 — sum of 2 functions (3 + 2), nested function not double-counted', () => {
    expect(complexityFor('src/retryWithLogging.ts', results)).toBe(5);
  });
});

describe('computeComplexity — fixtures/simple-project (low-complexity sanity check)', () => {
  const results = computeComplexity(path.join(FIXTURES_ROOT, 'simple-project'));

  it('every straight-line function is complexity 1, notificationService.ts (one if) is 2', () => {
    expect(complexityFor('src/index.ts', results)).toBe(1);
    expect(complexityFor('src/userService.ts', results)).toBe(1);
    expect(complexityFor('src/orderService.ts', results)).toBe(1);
    expect(complexityFor('src/database.ts', results)).toBe(1);
    expect(complexityFor('src/notificationService.ts', results)).toBe(2);
  });
});
