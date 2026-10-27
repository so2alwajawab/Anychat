export const OAUTH_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_engagement',
  'pages_manage_metadata',
  'pages_messaging',
] as const;

export const OAUTH_SCOPES_INSTAGRAM = ['instagram_basic', 'instagram_manage_comments'] as const;

export const PAGE_WEBHOOK_FIELDS = ['feed'] as const;
export const IG_WEBHOOK_FIELDS = ['comments'] as const;

export const OAUTH_STATE_TTL_SECONDS = 60 * 10;
export const OAUTH_STATE_COOKIE = 'anychat_oauth';
export const WEBHOOK_FLOOD_PER_MINUTE = 120;

export const APP_SECRET_AAD = 'meta_app_config:app_secret';
export const VERIFY_TOKEN_AAD = 'meta_app_config:webhook_verify_token';
