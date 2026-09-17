import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ChurnResult, ChurnWindow } from './types';

const execFileAsync = promisify(execFile);

// A marker string, distinguishable from any numstat line (which is always
// tab-separated), used to find where each commit's block starts.
const COMMIT_MARKER = '@@CODEATLAS_COMMIT@@';

function resolveWindowBounds(window: ChurnWindow): { since: string; until: string } {
  const until = window.asOf;
  const since = new Date(until.getTime() - window.windowDays * 24 * 60 * 60 * 1000);
  return { since: since.toISOString(), until: until.toISOString() };
}

/**
 * Counts commits per file. Every numstat line represents one file touched
 * by one commit, so a plain per-line increment already counts distinct
 * commits per file — no separate dedup needed.
 */
function countCommitsPerFile(gitLogOutput: string): Map<string, number> {
  const commitCountByModule = new Map<string, number>();

  for (const line of gitLogOutput.split('\n')) {
    if (line === '' || line === COMMIT_MARKER) {
      continue;
    }
    const columns = line.split('\t');
    if (columns.length !== 3) {
      continue;
    }
    const moduleId = columns[2];
    commitCountByModule.set(moduleId, (commitCountByModule.get(moduleId) ?? 0) + 1);
  }

  return commitCountByModule;
}

/**
 * Git churn: number of distinct commits touching each file within
 * [asOf - windowDays, asOf], both bounds inclusive (verified against real
 * `git log --since/--until` behavior — see fixtures/churn-repo/EXPECTED.md).
 * `asOf` is always caller-supplied, never read from the system clock, so
 * this is fully deterministic. Rename detection is deliberately disabled
 * (`--no-renames`) — see fixtures/churn-repo/EXPECTED.md's "Kapsam dışı"
 * section.
 */
export async function computeChurn(repoPath: string, window: ChurnWindow): Promise<ChurnResult[]> {
  const { since, until } = resolveWindowBounds(window);

  const { stdout } = await execFileAsync(
    'git',
    [
      'log',
      '--no-renames',
      '--numstat',
      `--since=${since}`,
      `--until=${until}`,
      `--pretty=format:${COMMIT_MARKER}`,
    ],
    { cwd: repoPath },
  );

  const commitCountByModule = countCommitsPerFile(stdout);

  return [...commitCountByModule.entries()]
    .map(([module_id, churn_commits]) => ({ module_id, churn_commits }))
    .sort((a, b) => a.module_id.localeCompare(b.module_id));
}
