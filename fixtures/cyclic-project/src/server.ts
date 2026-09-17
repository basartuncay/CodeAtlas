import { renewSession } from './sessionManager';
import type { Token } from './tokenStore';

export function handleRenewRequest(token: Token, sessionId: string): Token {
  return renewSession(token, sessionId);
}
