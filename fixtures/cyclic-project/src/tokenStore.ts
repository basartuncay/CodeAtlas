import { invalidateSession } from './sessionManager';

export interface Token {
  value: string;
  expiresAt: number;
}

// Circular on purpose: refreshing a token needs to invalidate the old
// session, which lives in sessionManager.ts — which itself depends on
// authService.ts, which depends back on this file. See EXPECTED.md.
export function refreshToken(oldToken: Token, sessionId: string): Token {
  invalidateSession(sessionId);
  return { value: `${oldToken.value}-refreshed`, expiresAt: Date.now() + 3600_000 };
}
