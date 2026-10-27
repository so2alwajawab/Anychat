import type { Response } from 'express';
import { CSRF_COOKIE, SESSION_COOKIE } from '@anychat/shared';
import { OAUTH_STATE_COOKIE, OAUTH_STATE_TTL_SECONDS } from '../modules/meta/meta.constants.js';
import { serverEnv, SESSION_IDLE_SECONDS } from './config/env.js';

function cookieBase(path: string) {
  return {
    path,
    secure: true,
    sameSite: 'strict' as const,
    ...(serverEnv.COOKIE_DOMAIN ? { domain: serverEnv.COOKIE_DOMAIN } : {}),
  };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    ...cookieBase('/api'),
    httpOnly: true,
    maxAge: SESSION_IDLE_SECONDS * 1000,
  });
}

export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(CSRF_COOKIE, token, {
    ...cookieBase('/api'),
    httpOnly: false,
    maxAge: SESSION_IDLE_SECONDS * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieBase('/api'));
  res.clearCookie(CSRF_COOKIE, cookieBase('/api'));
}

/**
 * OAuth state binding cookie: SameSite=Lax (not Strict) because the Meta
 * callback is a cross-site top-level navigation, where Strict cookies are not
 * sent. The state itself is random, one-time, TTL-bound, and verified against
 * a server-side Redis record.
 */
export function setOauthStateCookie(res: Response, state: string): void {
  res.cookie(OAUTH_STATE_COOKIE, state, {
    path: '/api/v1/meta',
    secure: true,
    sameSite: 'lax',
    httpOnly: true,
    maxAge: OAUTH_STATE_TTL_SECONDS * 1000,
    ...(serverEnv.COOKIE_DOMAIN ? { domain: serverEnv.COOKIE_DOMAIN } : {}),
  });
}

export function clearOauthStateCookie(res: Response): void {
  res.clearCookie(OAUTH_STATE_COOKIE, {
    path: '/api/v1/meta',
    secure: true,
    sameSite: 'lax',
    httpOnly: true,
    ...(serverEnv.COOKIE_DOMAIN ? { domain: serverEnv.COOKIE_DOMAIN } : {}),
  });
}
