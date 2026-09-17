import { refreshToken, type Token } from './tokenStore';
import { log } from './logger';

export function reauthenticate(token: Token, sessionId: string): Token {
  log(`reauthenticating session ${sessionId}`);
  return refreshToken(token, sessionId);
}
