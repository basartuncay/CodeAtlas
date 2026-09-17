import path from 'node:path';
import { Project } from 'ts-morph';
import type { LocResult } from './types';

/**
 * LOC = ts-morph's getEndLineNumber(), i.e. the number of '\n'-delimited
 * segments in the file's raw text. This is always exactly ONE MORE than
 * `wc -l` would report for the same file (wc -l counts '\n' characters;
 * splitting on '\n' always yields one more segment than there are
 * delimiters) — regardless of whether the file ends with a trailing
 * newline. Verified empirically, not assumed — see
 * fixtures/complex-functions/EXPECTED.md's LOC section.
 */
export function computeLoc(projectRoot: string): LocResult[] {
  const project = new Project({ skipAddingFilesFromTsConfig: true });

  // ts-morph's glob-based file discovery silently drops directories along
  // process.cwd()'s own ancestor chain (and everything reached only by
  // continuing to crawl a pruned ancestor) — even though every pattern
  // here is already absolute and has nothing to do with cwd. Concretely:
  // analyzing the monorepo root from cwd=<root>/packages/web silently
  // dropped packages/engine, packages/web itself, and packages/llm-synthesis
  // entirely. Matching cwd to projectRoot for the duration of the scan
  // avoids the mismatch. Same bug and same fix as computeComplexity — see
  // its "process.cwd() nested under projectRoot" regression test for the
  // confirmed repro.
  const originalCwd = process.cwd();
  let sourceFiles;
  try {
    process.chdir(projectRoot);
    project.addSourceFilesAtPaths([
      path.join(projectRoot, '**/*.ts'),
      `!${path.join(projectRoot, '**/*.d.ts')}`,
      `!${path.join(projectRoot, '**/node_modules/**')}`,
    ]);
    sourceFiles = project.getSourceFiles();
  } finally {
    process.chdir(originalCwd);
  }

  return sourceFiles
    .map((sourceFile) => ({
      module_id: path.relative(projectRoot, sourceFile.getFilePath()).split(path.sep).join('/'),
      loc: sourceFile.getEndLineNumber(),
    }))
    .sort((a, b) => a.module_id.localeCompare(b.module_id));
}
