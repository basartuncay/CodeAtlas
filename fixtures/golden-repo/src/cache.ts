import { save } from './store';

const cached = new Set<string>();

export function invalidate(key: string): void {
  cached.delete(key);
}

export function put(key: string, attemptCount: number): void {
  cached.add(key);
  save(key, attemptCount);
}
