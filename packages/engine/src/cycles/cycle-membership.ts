import type { Cycle, CycleMembership } from './types';

export function cycleMembership(modules: string[], cycles: Cycle[]): CycleMembership {
  const modulesInCycles = new Set<string>();
  for (const cycle of cycles) {
    for (const moduleId of cycle) {
      modulesInCycles.add(moduleId);
    }
  }

  return Object.fromEntries(modules.map((moduleId) => [moduleId, modulesInCycles.has(moduleId)]));
}
