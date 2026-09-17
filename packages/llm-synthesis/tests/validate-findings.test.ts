import { describe, expect, it } from 'vitest';
import type { AnalysisResult } from '@codeatlas/engine';
import { validateFindings } from '../src/validate-findings';

// A small, hand-built analysis model — NOT derived from a real fixture,
// because this suite tests the validator's own logic in isolation, per
// the design: it must work identically whether fed a live LLM response or
// a pre-recorded one, and must never call an LLM. Round-tripped through
// JSON so src/isolated.ts's instability is really `null` at runtime, i.e.
// exactly what an LLM would actually see (JSON has no NaN) — see ADR 0001.
const MODEL: AnalysisResult = JSON.parse(
  JSON.stringify({
    schema_version: '1.0',
    repo: { url: null, commit: 'abc123', analyzed_at: '2024-01-01T00:00:00.000Z' },
    modules: [
      {
        id: 'src/serviceA.ts',
        loc: 100,
        cyclomatic_complexity: 20,
        fan_in: 5,
        fan_out: 3,
        instability: 0.375,
        churn_commits_90d: 15,
        hotspot_score: 0.81,
        blast_radius: 8,
        in_cycle: false,
      },
      {
        id: 'src/serviceB.ts',
        loc: 50,
        cyclomatic_complexity: 5,
        fan_in: 2,
        fan_out: 1,
        instability: 0.3333,
        churn_commits_90d: 2,
        hotspot_score: 0.1,
        blast_radius: 3,
        in_cycle: false,
      },
      {
        id: 'src/isolated.ts',
        loc: 10,
        cyclomatic_complexity: 1,
        fan_in: 0,
        fan_out: 0,
        instability: NaN,
        churn_commits_90d: 0,
        hotspot_score: 0,
        blast_radius: 0,
        in_cycle: false,
      },
    ],
    edges: [],
    cycles: [],
    risks: [],
  }),
);

describe('validateFindings — fixture 1: fully correct / grounded response', () => {
  it('accepts every finding when module_ids and values are all real', () => {
    const result = validateFindings(
      {
        summary: 'src/serviceA.ts is the top hotspot.',
        findings: [
          {
            module_id: 'src/serviceA.ts',
            claim: 'High complexity and churn make this the top hotspot.',
            supporting_metric: 'hotspot_score',
            value_cited: 0.81,
          },
          {
            module_id: 'src/serviceB.ts',
            claim: 'Modest fan-in, low risk.',
            supporting_metric: 'fan_in',
            value_cited: 2,
          },
        ],
      },
      MODEL,
    );

    expect(result.schemaValid).toBe(true);
    expect(result.summary).toBe('src/serviceA.ts is the top hotspot.');
    expect(result.acceptedFindings).toHaveLength(2);
    expect(result.rejectedFindings).toHaveLength(0);
  });
});

describe('validateFindings — fixture 2: schema error', () => {
  it('rejects everything when value_cited is a string, not a number', () => {
    const result = validateFindings(
      {
        summary: 'src/serviceA.ts is risky.',
        findings: [
          {
            module_id: 'src/serviceA.ts',
            claim: 'Risky.',
            supporting_metric: 'hotspot_score',
            value_cited: '0.81', // string, not number -> fails the Zod schema
          },
        ],
      },
      MODEL,
    );

    expect(result.schemaValid).toBe(false);
    expect(result.summary).toBeNull();
    expect(result.acceptedFindings).toHaveLength(0);
    expect(result.rejectedFindings).toHaveLength(0);
  });

  it('rejects everything when the findings field is missing entirely', () => {
    const result = validateFindings({ summary: 'No findings field.' }, MODEL);
    expect(result.schemaValid).toBe(false);
  });
});

describe('validateFindings — fixture 3: unknown module_id', () => {
  it('rejects only the finding citing a nonexistent module, accepts the rest', () => {
    const result = validateFindings(
      {
        summary: '...',
        findings: [
          {
            module_id: 'src/serviceA.ts',
            claim: 'Real module.',
            supporting_metric: 'hotspot_score',
            value_cited: 0.81,
          },
          {
            module_id: 'src/nonexistent.ts',
            claim: 'Hallucinated module.',
            supporting_metric: 'hotspot_score',
            value_cited: 0.5,
          },
        ],
      },
      MODEL,
    );

    expect(result.schemaValid).toBe(true);
    expect(result.acceptedFindings).toHaveLength(1);
    expect(result.acceptedFindings[0]?.module_id).toBe('src/serviceA.ts');
    expect(result.rejectedFindings).toHaveLength(1);
    expect(result.rejectedFindings[0]).toMatchObject({
      reason: 'unknown_module_id',
      finding: { module_id: 'src/nonexistent.ts' },
    });
  });
});

describe('validateFindings — fixture 4: wrong value_cited', () => {
  it('rejects only the finding with a value outside tolerance, accepts the rest', () => {
    const result = validateFindings(
      {
        summary: '...',
        findings: [
          {
            module_id: 'src/serviceB.ts',
            claim: 'Correct value.',
            supporting_metric: 'fan_in',
            value_cited: 2,
          },
          {
            module_id: 'src/serviceA.ts',
            claim: 'Wrong value — real hotspot_score is 0.81.',
            supporting_metric: 'hotspot_score',
            value_cited: 0.5,
          },
        ],
      },
      MODEL,
    );

    expect(result.acceptedFindings).toHaveLength(1);
    expect(result.acceptedFindings[0]?.module_id).toBe('src/serviceB.ts');
    expect(result.rejectedFindings).toHaveLength(1);
    expect(result.rejectedFindings[0]).toMatchObject({
      reason: 'numeric_mismatch',
      finding: { module_id: 'src/serviceA.ts' },
    });
  });

  it('accepts a value clearly within the 0.01 tolerance', () => {
    // Deliberately not "exactly 0.01 off": 0.81 - 0.8 === 0.010000000000000009
    // in IEEE754 floating point, not 0.01 — testing the razor's-edge
    // boundary with decimal literals would test float representation
    // noise, not this function's logic. 0.005 has enough margin either way.
    const result = validateFindings(
      {
        summary: '...',
        findings: [
          {
            module_id: 'src/serviceA.ts',
            claim: 'Within tolerance.',
            supporting_metric: 'hotspot_score',
            value_cited: 0.805, // real is 0.81, diff = 0.005
          },
        ],
      },
      MODEL,
    );

    expect(result.acceptedFindings).toHaveLength(1);
    expect(result.rejectedFindings).toHaveLength(0);
  });

  it('rejects a value just past the 0.01 tolerance boundary', () => {
    const result = validateFindings(
      {
        summary: '...',
        findings: [
          {
            module_id: 'src/serviceA.ts',
            claim: 'Just past the boundary.',
            supporting_metric: 'hotspot_score',
            value_cited: 0.7989, // real is 0.81, diff = 0.0111 > tolerance
          },
        ],
      },
      MODEL,
    );

    expect(result.acceptedFindings).toHaveLength(0);
    expect(result.rejectedFindings).toHaveLength(1);
    expect(result.rejectedFindings[0]?.reason).toBe('numeric_mismatch');
  });
});

describe('validateFindings — additional edge cases (not requested, added deliberately)', () => {
  it('rejects a finding citing a null metric value (isolated module, NaN/null instability)', () => {
    const result = validateFindings(
      {
        summary: '...',
        findings: [
          {
            module_id: 'src/isolated.ts',
            claim: 'Citing an ungroundable metric.',
            supporting_metric: 'instability',
            value_cited: 0.5,
          },
        ],
      },
      MODEL,
    );

    expect(result.rejectedFindings).toHaveLength(1);
    expect(result.rejectedFindings[0]?.reason).toBe('null_metric_value');
  });

  it('rejects a finding citing a non-numeric field (in_cycle) as the supporting_metric', () => {
    const result = validateFindings(
      {
        summary: '...',
        findings: [
          {
            module_id: 'src/serviceA.ts',
            claim: 'Citing a boolean field as if it were numeric.',
            supporting_metric: 'in_cycle',
            value_cited: 1,
          },
        ],
      },
      MODEL,
    );

    expect(result.rejectedFindings).toHaveLength(1);
    expect(result.rejectedFindings[0]?.reason).toBe('unknown_metric');
  });
});
