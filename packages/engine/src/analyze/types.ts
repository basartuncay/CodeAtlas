import type { DependencyEdge } from '../graph/types';
import type { Cycle } from '../cycles/types';
import type { Risk } from '../risks/types';

export interface AnalyzeOptions {
  /**
   * Reference "now" for both the churn window and `repo.analyzed_at`.
   * Defaults to `new Date()` when omitted.
   *
   * NOTE: that default is NOT covered by any test — every test (including
   * the golden-file test) always injects a fixed `asOf`. Only the
   * explicit-asOf code path is verified.
   */
  asOf?: Date;
  /** Overrides the git-remote-derived repo URL (e.g. for CI where the
   * checkout has no configured remote but the URL is known some other way). */
  repoUrl?: string | null;
}

export interface ModuleResult {
  id: string;
  loc: number;
  cyclomatic_complexity: number;
  fan_in: number;
  fan_out: number;
  instability: number;
  churn_commits_90d: number;
  hotspot_score: number;
  blast_radius: number;
  in_cycle: boolean;
}

export interface AnalysisResult {
  schema_version: '1.0';
  repo: {
    url: string | null;
    commit: string;
    analyzed_at: string;
  };
  modules: ModuleResult[];
  edges: DependencyEdge[];
  cycles: Cycle[];
  risks: Risk[];
}
