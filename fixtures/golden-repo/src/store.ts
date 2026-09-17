import { MAX_RETRIES } from './config';
import { invalidate } from './cache';

export function save(key: string, attemptCount: number): boolean {
  if (attemptCount >= MAX_RETRIES) {
    invalidate(key);
    return false;
  }
  return true;
}
