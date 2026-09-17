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
  project.addSourceFilesAtPaths([
    path.join(projectRoot, '**/*.ts'),
    `!${path.join(projectRoot, '**/*.d.ts')}`,
    `!${path.join(projectRoot, '**/node_modules/**')}`,
  ]);

  return project
    .getSourceFiles()
    .map((sourceFile) => ({
      module_id: path.relative(projectRoot, sourceFile.getFilePath()).split(path.sep).join('/'),
      loc: sourceFile.getEndLineNumber(),
    }))
    .sort((a, b) => a.module_id.localeCompare(b.module_id));
}
