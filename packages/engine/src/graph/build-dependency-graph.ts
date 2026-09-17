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
  const cruiseOutput = await cruise(['.'], {
    outputType: 'json',
    exclude: 'node_modules',
    baseDir: projectRoot,
  });

  const result: ICruiseResult =
    typeof cruiseOutput.output === 'string' ? JSON.parse(cruiseOutput.output) : cruiseOutput.output;

  return {
    modules: result.modules.map((module) => module.source),
    edges: result.modules.flatMap(edgesForModule),
  };
}
