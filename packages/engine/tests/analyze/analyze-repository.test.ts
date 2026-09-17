import { execFileSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { analyzeRepository } from '../../src/analyze/analyze-repository';
import {
  createGoldenFixtureRepo,
  type GoldenFixtureRepo,
} from '../helpers/create-golden-fixture-repo';

// See fixtures/golden-repo/EXPECTED.md for the full hand-computed, then
// cross-validated-against-real-code, expected output this test checks.
const FIXED_ASOF = new Date('2024-01-01T00:00:00Z');

const EXPECTED_MODULES = [
  {
    id: 'src/cache.ts',
    loc: 13,
    cyclomatic_complexity: 2,
    fan_in: 2,
    fan_out: 1,
    instability: 0.3333,
    churn_commits_90d: 2,
    hotspot_score: 0.6,
    blast_radius: 2,
    in_cycle: true,
  },
  {
    id: 'src/config.ts',
    loc: 2,
    cyclomatic_complexity: 0,
    fan_in: 1,
    fan_out: 0,
    instability: 0,
    churn_commits_90d: 1,
    hotspot_score: 0,
    blast_radius: 3,
    in_cycle: false,
  },
  {
    id: 'src/logger.ts',
    loc: 8,
    cyclomatic_complexity: 2,
    fan_in: 1,
    fan_out: 0,
    instability: 0,
    churn_commits_90d: 0,
    hotspot_score: 0,
    blast_radius: 1,
    in_cycle: false,
  },
  {
    id: 'src/main.ts',
    loc: 8,
    cyclomatic_complexity: 1,
    fan_in: 0,
    fan_out: 2,
    instability: 1,
    churn_commits_90d: 1,
    hotspot_score: 0.08,
    blast_radius: 0,
    in_cycle: false,
  },
  {
    id: 'src/store.ts',
    loc: 11,
    cyclomatic_complexity: 2,
    fan_in: 1,
    fan_out: 2,
    instability: 0.6667,
    churn_commits_90d: 1,
    hotspot_score: 0.24,
    blast_radius: 2,
    in_cycle: true,
  },
];

// src/standalone.ts is handled separately below (its instability is NaN).
const EXPECTED_STANDALONE = {
  id: 'src/standalone.ts',
  loc: 2,
  cyclomatic_complexity: 1,
  fan_in: 0,
  fan_out: 0,
  churn_commits_90d: 0,
  hotspot_score: 0,
  blast_radius: 0,
  in_cycle: false,
};

const EXPECTED_EDGES = [
  { from: 'src/cache.ts', to: 'src/store.ts' },
  { from: 'src/main.ts', to: 'src/cache.ts' },
  { from: 'src/main.ts', to: 'src/logger.ts' },
  { from: 'src/store.ts', to: 'src/cache.ts' },
  { from: 'src/store.ts', to: 'src/config.ts' },
];

const EXPECTED_CYCLES = [['src/cache.ts', 'src/store.ts']];

const EXPECTED_RISKS = [
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
];

describe('analyzeRepository — golden file (fixtures/golden-repo)', () => {
  let fixture: GoldenFixtureRepo;

  beforeEach(() => {
    fixture = createGoldenFixtureRepo();
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('produces the exact analysis documented in fixtures/golden-repo/EXPECTED.md', async () => {
    const result = await analyzeRepository(fixture.repoPath, { asOf: FIXED_ASOF });

    expect(result.schema_version).toBe('1.0');
    expect(result.edges).toEqual(EXPECTED_EDGES);
    expect(result.cycles).toEqual(EXPECTED_CYCLES);
    expect(result.risks).toEqual(EXPECTED_RISKS);
    expect(result.modules).toHaveLength(6);

    const byId = new Map(result.modules.map((module) => [module.id, module]));

    for (const expected of EXPECTED_MODULES) {
      expect(byId.get(expected.id)).toEqual(expected);
    }
  });

  it('src/standalone.ts: instability is NaN in the raw result (undefined, not defaulted)', async () => {
    const result = await analyzeRepository(fixture.repoPath, { asOf: FIXED_ASOF });
    const standalone = result.modules.find((module) => module.id === 'src/standalone.ts');
    if (!standalone) {
      throw new Error('src/standalone.ts missing from result.modules');
    }

    expect(standalone.instability).toBeNaN();
    // every other field is a normal, well-defined value
    expect({ ...standalone, instability: undefined }).toEqual({
      ...EXPECTED_STANDALONE,
      instability: undefined,
    });
  });

  it('standalone.ts instability: NaN really becomes null after JSON serialization', async () => {
    const result = await analyzeRepository(fixture.repoPath, { asOf: FIXED_ASOF });

    const serialized = JSON.parse(JSON.stringify(result)) as typeof result;
    const serializedStandalone = serialized.modules.find((module) => module.id === 'src/standalone.ts');

    expect(serializedStandalone?.instability).toBeNull();
  });

  it('repo metadata is read from the environment: commit=real HEAD, url=null (no remote), analyzed_at=asOf', async () => {
    const result = await analyzeRepository(fixture.repoPath, { asOf: FIXED_ASOF });

    const realHeadSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fixture.repoPath })
      .toString()
      .trim();

    expect(result.repo.commit).toBe(realHeadSha);
    expect(result.repo.url).toBeNull();
    expect(result.repo.analyzed_at).toBe(FIXED_ASOF.toISOString());
  });
});
