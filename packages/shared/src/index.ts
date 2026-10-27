export * from './i18n/ar.js';
export * from './errors.js';
export * from './password.js';
export * from './security/redact.js';
export * from './security/tokens.js';
export * from './env.js';

export const API_PREFIX = '/api/v1';

export const API_ROUTES = {
  csrf: `${API_PREFIX}/auth/csrf`,
  login: `${API_PREFIX}/auth/login`,
  logout: `${API_PREFIX}/auth/logout`,
  session: `${API_PREFIX}/auth/session`,
  recovery: `${API_PREFIX}/auth/recovery`,
  audit: `${API_PREFIX}/audit`,
  metaConfig: `${API_PREFIX}/meta/config`,
  metaOauthStart: `${API_PREFIX}/meta/oauth/start`,
  metaOauthCallback: `${API_PREFIX}/meta/oauth/callback`,
  metaAssets: `${API_PREFIX}/meta/assets`,
  metaWebhookDiagnostics: `${API_PREFIX}/meta/webhooks/diagnostics`,
  webhooksMeta: `${API_PREFIX}/webhooks/meta`,
  healthz: '/healthz',
  readyz: '/readyz',
} as const;
