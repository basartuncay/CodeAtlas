import { reauthenticate } from './authService';
import type { Token } from './tokenStore';

const activeSessions = new Set<string>();

export function invalidateSession(sessionId: string): void {
  activeSessions.delete(sessionId);
}

export function renewSession(token: Token, sessionId: string): Token {
  return reauthenticate(token, sessionId);
}
