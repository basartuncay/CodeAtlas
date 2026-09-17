import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { analyzeRepository } from '../src/index';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const OUTPUT_PATH = path.resolve(HERE, '../analysis.json');

/**
 * CI quality gate — one simple condition, per docs/PLAN.md's Self-analysis
 * section ("optionally fail the build if hotspot count or max complexity
 * regresses past a defined threshold").
 *
 * 0.95 is deliberately high, not a typical "quality bar": this repo
 * already has legitimately complex test files scoring ~0.87 today (see
 * fixtures/complex-functions, the engine's own complexity tests). This
 * gate exists to catch a genuinely extreme regression, not to block
 * ordinary development — a lower threshold like 0.7 (PLAN.md's own
 * high_hotspot risk-rule example) would fail on the very first CI run.
 */
const MAX_HOTSPOT_SCORE_GATE = 0.95;

async function main(): Promise<void> {
  // No injected `asOf` — this is the one real place the default
  // (new Date()) path is meant to run: analyzing the actual commit being
  // built, as of now. See AnalyzeOptions's doc comment.
  const result = await analyzeRepository(REPO_ROOT);
  writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));

  // hotspot_score is NaN only when the whole analysis has <=1 module
  // (see ADR 0004) — not a real scenario for this repo, but coerced to 0
  // rather than left to poison Math.max into NaN (which would silently
  // never fail the gate).
  const hotspotScores = result.modules.map((module) =>
    Number.isNaN(module.hotspot_score) ? 0 : module.hotspot_score,
  );
  const maxHotspotScore = hotspotScores.length > 0 ? Math.max(...hotspotScores) : 0;

  console.log(`Modules analyzed: ${result.modules.length}`);
  console.log(`Cycles detected: ${result.cycles.length}`);
  console.log(`Risks flagged: ${result.risks.length}`);
  console.log(`Max hotspot_score: ${maxHotspotScore.toFixed(4)} (gate: ${MAX_HOTSPOT_SCORE_GATE})`);

  if (maxHotspotScore > MAX_HOTSPOT_SCORE_GATE) {
    console.error(
      `Quality gate FAILED: max hotspot_score ${maxHotspotScore.toFixed(4)} exceeds ${MAX_HOTSPOT_SCORE_GATE}`,
    );
    process.exit(1);
  }

  console.log('Quality gate passed.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
