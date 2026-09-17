import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

interface FixtureCommitSpec {
  /** ISO 8601, UTC. Never relative to "now" — see fixtures/churn-repo/EXPECTED.md. */
  date: string;
  files: string[];
  message: string;
}

/**
 * The exact commit history documented in fixtures/churn-repo/EXPECTED.md.
 * Keep this array and that file in sync.
 */
const FIXTURE_COMMITS: FixtureCommitSpec[] = [
  { date: '2023-09-01T12:00:00Z', files: ['fileA.ts', 'fileB.ts'], message: 'init' },
  { date: '2023-10-03T00:00:00Z', files: ['fileB.ts'], message: 'since boundary' },
  { date: '2023-10-20T09:00:00Z', files: ['fileA.ts'], message: 'touch A' },
  { date: '2023-11-15T14:00:00Z', files: ['fileA.ts', 'fileC.ts'], message: 'touch A and C' },
  { date: '2023-12-05T10:00:00Z', files: ['fileB.ts'], message: 'touch B' },
  { date: '2023-12-31T23:59:59Z', files: ['fileA.ts'], message: 'touch A' },
  { date: '2024-01-01T00:00:00Z', files: ['fileC.ts'], message: 'until boundary (=asOf)' },
  { date: '2024-01-15T00:00:00Z', files: ['fileC.ts'], message: 'future, after asOf' },
];

export interface ChurnFixtureRepo {
  repoPath: string;
  cleanup: () => void;
}

/**
 * Creates a fresh, throwaway git repository under the OS temp directory
 * with the exact commit history in FIXTURE_COMMITS, using fixed
 * GIT_AUTHOR_DATE/GIT_COMMITTER_DATE for every commit so results never
 * depend on when the test runs. Each call gets its own mkdtemp'd
 * directory — this never creates or touches a .git nested inside the
 * CodeAtlas repo itself. Call `cleanup()` when done (e.g. in afterEach).
 *
 * Disables commit signing locally so this works unattended on any
 * machine/CI runner regardless of the caller's global git config (no
 * dependency on a configured GPG key being available non-interactively).
 */
export function createChurnFixtureRepo(): ChurnFixtureRepo {
  const repoPath = mkdtempSync(path.join(tmpdir(), 'codeatlas-churn-fixture-'));

  const git = (args: string[], extraEnv?: Record<string, string>): void => {
    execFileSync('git', args, {
      cwd: repoPath,
      env: { ...process.env, ...extraEnv },
      stdio: 'pipe',
    });
  };

  git(['init', '--quiet', '--initial-branch=main']);
  git(['config', 'user.email', 'fixture@codeatlas.test']);
  git(['config', 'user.name', 'CodeAtlas Fixture']);
  git(['config', 'commit.gpgsign', 'false']);

  for (const commit of FIXTURE_COMMITS) {
    for (const file of commit.files) {
      appendFileSync(path.join(repoPath, file), `// ${commit.message}\n`);
    }
    git(['add', ...commit.files]);
    git(['commit', '--quiet', '-m', commit.message], {
      GIT_AUTHOR_DATE: commit.date,
      GIT_COMMITTER_DATE: commit.date,
    });
  }

  return {
    repoPath,
    cleanup: () => rmSync(repoPath, { recursive: true, force: true }),
  };
}
