export interface ChurnResult {
  module_id: string;
  churn_commits: number;
}

/**
 * `asOf` and `windowDays` are always supplied by the caller — this never
 * reads `new Date()` internally, so results are fully deterministic and
 * independent of when the analysis runs.
 */
export interface ChurnWindow {
  asOf: Date;
  windowDays: number;
}
