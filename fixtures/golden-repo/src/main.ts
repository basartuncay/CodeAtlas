import { put } from './cache';
import { log } from './logger';

export function run(key: string, attemptCount: number): void {
  log(`processing ${key}`, 'info');
  put(key, attemptCount);
}
