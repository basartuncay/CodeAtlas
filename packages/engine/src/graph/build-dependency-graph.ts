import { realpathSync } from 'node:fs';
import { cruise } from 'dependency-cruiser';
import type { ICruiseResult, IDependency, IModule } from 'dependency-cruiser';
import type { DependencyEdge, DependencyGraph } from './types';

function isInternalDependency(dependency: IDependency): boolean {
  return !dependency.coreModule && !dependency.couldNotResolve;
}

function edgesForModule(module: IModule): DependencyEdge[] {
  return module.dependencies
    .filter(isInternalDependency)
    .map((dependency) => ({ from: module.source, to: dependency.resolved }));
}

export async function buildDependencyGraph(projectRoot: string): Promise<DependencyGraph> {
  // dependency-cruiser resolves circular imports' targets via realpath
  // internally but scans the initial file list against the given baseDir
  // as-is. If projectRoot is reached through a symlink (e.g. os.tmpdir()
  // on macOS: /var -> /private/var), those two conventions disagree and
  // the same file gets reported twice, under two different paths, as if
  // it were two separate modules. Realpath-ing up front makes both
  // conventions agree. See the "symlinked temp dir" regression test.
  const canonicalProjectRoot = realpathSync(projectRoot);

  const cruiseOutput = await cruise(['.'], {
    outputType: 'json',
    exclude: 'node_modules',
    baseDir: canonicalProjectRoot,
  });

  const result: ICruiseResult =
    typeof cruiseOutput.output === 'string' ? JSON.parse(cruiseOutput.output) : cruiseOutput.output;

  return {
    modules: result.modules.map((module) => module.source),
    edges: result.modules.flatMap(edgesForModule),
  };
}
