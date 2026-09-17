import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The static, reviewable source of truth for file *content* — see
// fixtures/golden-repo/EXPECTED.md. This script only synthesizes the git
// *history* around that content, in a throwaway temp repo.
const GOLDEN_REPO_SOURCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../fixtures/golden-repo/src',
);

const ALL_FILES = ['config.ts', 'logger.ts', 'store.ts', 'cache.ts', 'main.ts', 'standalone.ts'];

interface TouchCommitSpec {
  /** ISO 8601, UTC. Never relative to "now" — see EXPECTED.md. */
  date: string;
  files: string[];
  message: string;
}

const INIT_DATE = '2023-09-01T12:00:00Z';

/**
 * Commits after the init commit. Every one of these MODIFIES its target
 * file(s) in place (see touchFile below) rather than appending a new
 * line, so LOC stays exactly what fixtures/golden-repo/EXPECTED.md
 * documents for the static source files, regardless of how many times a
 * file gets touched.
 */
const TOUCH_COMMITS: TouchCommitSpec[] = [
  { date: '2023-10-15T09:00:00Z', files: ['main.ts'], message: 'touch main' },
  { date: '2023-11-10T09:00:00Z', files: ['cache.ts', 'store.ts'], message: 'touch cache and store' },
  { date: '2023-12-05T09:00:00Z', files: ['cache.ts'], message: 'touch cache again' },
  { date: '2023-12-20T09:00:00Z', files: ['config.ts'], message: 'touch config' },
  { date: '2024-01-15T00:00:00Z', files: ['logger.ts'], message: 'touch logger (future, after asOf)' },
];

export interface GoldenFixtureRepo {
  repoPath: string;
  cleanup: () => void;
}

/** Replaces the file's final newline with " // <marker>\n" — a real byte
 * change (registers as a git commit touching the file) that does NOT add
 * a new line, so getEndLineNumber() (LOC) is unaffected no matter how
 * many times a file is touched. */
function touchFile(filePath: string, marker: string): void {
  const content = readFileSync(filePath, 'utf8');
  const touched = content.endsWith('\n') ? content.replace(/\n$/, ` // ${marker}\n`) : `${content} // ${marker}\n`;
  writeFileSync(filePath, touched);
}

export function createGoldenFixtureRepo(): GoldenFixtureRepo {
  const repoPath = mkdtempSync(path.join(tmpdir(), 'codeatlas-golden-fixture-'));
  const srcDir = path.join(repoPath, 'src');
  mkdirSync(srcDir, { recursive: true });

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

  for (const file of ALL_FILES) {
    const content = readFileSync(path.join(GOLDEN_REPO_SOURCE, file), 'utf8');
    writeFileSync(path.join(srcDir, file), content);
  }
  git(['add', ...ALL_FILES.map((file) => `src/${file}`)]);
  git(['commit', '--quiet', '-m', 'init'], { GIT_AUTHOR_DATE: INIT_DATE, GIT_COMMITTER_DATE: INIT_DATE });

  for (const commit of TOUCH_COMMITS) {
    for (const file of commit.files) {
      touchFile(path.join(srcDir, file), commit.message);
    }
    git(['add', ...commit.files.map((file) => `src/${file}`)]);
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
