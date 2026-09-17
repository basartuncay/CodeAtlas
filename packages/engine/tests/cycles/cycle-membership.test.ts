import { describe, expect, it } from 'vitest';
import { cycleMembership } from '../../src/cycles/cycle-membership';

describe('cycleMembership', () => {
  it('marks every module in a cycle as true, everything else false', () => {
    const modules = ['a.ts', 'b.ts', 'c.ts', 'd.ts'];
    const cycles = [['a.ts', 'b.ts']];

    expect(cycleMembership(modules, cycles)).toEqual({
      'a.ts': true,
      'b.ts': true,
      'c.ts': false,
      'd.ts': false,
    });
  });

  it('returns all-false when there are no cycles', () => {
    const modules = ['a.ts', 'b.ts'];
    expect(cycleMembership(modules, [])).toEqual({ 'a.ts': false, 'b.ts': false });
  });
});
