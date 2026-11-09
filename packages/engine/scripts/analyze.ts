import { appendFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { analyzeRepository, evaluateQualityGate, renderSummary } from '../src/index';

/**
 * Deterministic analysis CLI (no LLM, no API key). Used by this repo's own CI
 * (`npm run self-analyze`) and by the GitHub Action in /action.yml.
 *
 *   tsx scripts/analyze.ts [repoPath] [--out analysis.json] [--summary report.md]
 *                          [--max-hotspot 0.95] [--top 10]
 *
 * --summary appends (GITHUB_STEP_SUMMARY is append-only by convention).
 * Exit code 1 when --max-hotspot is given and exceeded.
 */
async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      summary: { type: 'string' },
      'max-hotspot': { type: 'string' },
      top: { type: 'string', default: '10' },
    },
  });

  const repoPath = path.resolve(positionals[0] ?? process.cwd());
  const threshold = values['max-hotspot'] ? Number(values['max-hotspot']) : null;
  const topN = Number(values.top);
  if (threshold !== null && !(threshold >= 0 && threshold <= 1)) {
    throw new Error(`--max-hotspot must be a number between 0 and 1, got ${values['max-hotspot']}`);
  }
  if (!Number.isInteger(topN) || topN < 1) {
    throw new Error(`--top must be a positive integer, got ${values.top}`);
  }

  // No injected `asOf`: analyze the commit being built, as of now (see AnalyzeOptions).
  const result = await analyzeRepository(repoPath);
  const gate = evaluateQualityGate(result, threshold);

  if (values.out) writeFileSync(values.out, JSON.stringify(result, null, 2));
  if (values.summary) appendFileSync(values.summary, `${renderSummary(result, gate, topN)}\n`);

  console.log(`Modules analyzed: ${result.modules.length}`);
  console.log(`Cycles detected: ${result.cycles.length}`);
  console.log(`Risks flagged: ${result.risks.length}`);
  console.log(
    `Max hotspot_score: ${gate.maxHotspotScore.toFixed(4)}` +
      (threshold === null ? '' : ` (gate: ${threshold})`),
  );

  if (!gate.passed) {
    console.error(`Quality gate FAILED: max hotspot_score exceeds ${threshold}`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
