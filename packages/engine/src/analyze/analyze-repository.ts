import { execFileSync } from 'node:child_process';
import { buildDependencyGraph } from '../graph/build-dependency-graph';
import { computeCouplingMetrics } from '../metrics/coupling';
import { detectCycles } from '../cycles/detect-cycles';
import { cycleMembership } from '../cycles/cycle-membership';
import { computeBlastRadius } from '../blast-radius/compute-blast-radius';
import { computeComplexity } from '../complexity/compute-complexity';
import { computeLoc } from '../loc/compute-loc';
import { computeChurn } from '../churn/compute-churn';
import { computeHotspotScore } from '../hotspot/compute-hotspot';
import { computeRisks } from '../risks/compute-risks';
import type { Cycle } from '../cycles/types';
import type { AnalysisResult, AnalyzeOptions, ModuleResult } from './types';

// Not a caller-configurable option — see ADR 0004 / EXPECTED.md's
// discussion of why "churn_commits_90d" is a fixed field name, not a
// dynamic one built from a configurable window.
const CHURN_WINDOW_DAYS = 90;
const ROUND_DECIMALS = 4;

function round(value: number): number {
  const factor = 10 ** ROUND_DECIMALS;
  return Math.round(value * factor) / factor;
}

function sortCycleMembers(cycle: Cycle): Cycle {
  return [...cycle].sort((a, b) => a.localeCompare(b));
}

function readCommit(repoPath: string): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoPath }).toString().trim();
}

function readRepoUrl(repoPath: string): string | null {
  try {
    return execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: repoPath,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

export async function analyzeRepository(
  repoPath: string,
  options: AnalyzeOptions = {},
): Promise<AnalysisResult> {
  // asOf defaults to the real system clock here — this default path is
  // NOT covered by any test; every test (including the golden-file test)
  // always injects a fixed asOf. See AnalyzeOptions.
  const asOf = options.asOf ?? new Date();

  const graph = await buildDependencyGraph(repoPath);
  const coupling = computeCouplingMetrics(graph);
  const cycles = detectCycles(graph).map(sortCycleMembers).sort((a, b) => a[0].localeCompare(b[0]));
  const inCycle = cycleMembership(graph.modules, cycles);
  const blastRadius = computeBlastRadius(graph);
  const complexity = computeComplexity(repoPath);
  const loc = computeLoc(repoPath);
  const churn = await computeChurn(repoPath, { asOf, windowDays: CHURN_WINDOW_DAYS });
  const hotspot = computeHotspotScore(complexity, churn);

  const couplingByModule = new Map(coupling.map((entry) => [entry.module_id, entry]));
  const blastByModule = new Map(blastRadius.map((entry) => [entry.module_id, entry.blast_radius]));
  const locByModule = new Map(loc.map((entry) => [entry.module_id, entry.loc]));
  const churnByModule = new Map(churn.map((entry) => [entry.module_id, entry.churn_commits]));
  const hotspotByModule = new Map(hotspot.map((entry) => [entry.module_id, entry.hotspot_score]));

  // complexity's module set is authoritative ("files that currently
  // exist") — see ADR 0004's "Module set is authoritative from the
  // complexity side" consequence.
  const modules: ModuleResult[] = complexity
    .map((entry): ModuleResult => {
      const cp = couplingByModule.get(entry.module_id);
      if (!cp) {
        throw new Error(`no coupling metrics computed for ${entry.module_id}`);
      }
      const hotspotScore = hotspotByModule.get(entry.module_id);
      if (hotspotScore === undefined) {
        throw new Error(`no hotspot score computed for ${entry.module_id}`);
      }

      return {
        id: entry.module_id,
        loc: locByModule.get(entry.module_id) ?? 0,
        cyclomatic_complexity: entry.cyclomatic_complexity,
        fan_in: cp.fan_in,
        fan_out: cp.fan_out,
        instability: round(cp.instability),
        churn_commits_90d: churnByModule.get(entry.module_id) ?? 0,
        hotspot_score: round(hotspotScore),
        blast_radius: blastByModule.get(entry.module_id) ?? 0,
        in_cycle: inCycle[entry.module_id] ?? false,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const risks = computeRisks(
    modules.map((module) => ({
      module_id: module.id,
      hotspot_score: module.hotspot_score,
      in_cycle: module.in_cycle,
    })),
    cycles,
  );

  return {
    schema_version: '1.0',
    repo: {
      url: options.repoUrl ?? readRepoUrl(repoPath),
      commit: readCommit(repoPath),
      analyzed_at: asOf.toISOString(),
    },
    modules,
    edges: [...graph.edges].sort((a, b) => (a.from + a.to).localeCompare(b.from + b.to)),
    cycles,
    risks,
  };
}
