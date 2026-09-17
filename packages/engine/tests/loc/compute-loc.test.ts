import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeLoc } from '../../src/loc/compute-loc';

// fixtures/complex-functions/EXPECTED.md — LOC section: getEndLineNumber()
// is always exactly `wc -l` + 1 (verified empirically, not assumed), for
// every one of these four files.
const FIXTURE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../fixtures/complex-functions',
);

function locFor(moduleId: string, results: ReturnType<typeof computeLoc>): number {
  const found = results.find((r) => r.module_id === moduleId);
  if (!found) {
    throw new Error(`no LOC computed for ${moduleId}`);
  }
  return found.loc;
}

describe('computeLoc — fixtures/complex-functions', () => {
  const results = computeLoc(FIXTURE_ROOT);

  it('returns exactly one entry per file', () => {
    expect(results).toHaveLength(4);
  });

  it('src/formatMessage.ts: wc -l=5 -> loc=6', () => {
    expect(locFor('src/formatMessage.ts', results)).toBe(6);
  });

  it('src/processQueue.ts: wc -l=20 -> loc=21', () => {
    expect(locFor('src/processQueue.ts', results)).toBe(21);
  });

  it('src/retryWithLogging.ts: wc -l=16 -> loc=17', () => {
    expect(locFor('src/retryWithLogging.ts', results)).toBe(17);
  });

  it('src/riskLevel.ts: wc -l=10 -> loc=11', () => {
    expect(locFor('src/riskLevel.ts', results)).toBe(11);
  });
});
