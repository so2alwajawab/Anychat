export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILED: 'auth.login.failed',
  LOGIN_LOCKED: 'auth.login.locked',
  LOGIN_RATE_LIMITED: 'auth.login.rate_limited',
  LOGOUT: 'auth.logout',
  SESSION_FINGERPRINT_MISMATCH: 'auth.session.fingerprint_mismatch',
  RECOVERY_USED: 'auth.recovery.used',
  RECOVERY_RATE_LIMITED: 'auth.recovery.rate_limited',
  RECOVERY_CODE_ROTATED: 'auth.recovery.code_rotated',
  OWNER_BOOTSTRAPPED: 'owner.bootstrapped',
  OWNER_PASSWORD_RESET: 'owner.password_reset',
  AUDIT_QUERY_FAILED: 'audit.query_failed',
  META_CONFIG_UPDATED: 'meta.config.updated',
  META_OAUTH_STARTED: 'meta.oauth.started',
  META_OAUTH_COMPLETED: 'meta.oauth.completed',
  META_OAUTH_FAILED: 'meta.oauth.failed',
  META_ASSET_SELECTED: 'meta.asset.selected',
  META_ASSET_UNSELECTED: 'meta.asset.unselected',
  META_ASSET_DELETED: 'meta.asset.deleted',
  META_ASSET_HEALTH: 'meta.asset.health',
  META_SUBSCRIPTION_SET: 'meta.subscription.set',
  WORKFLOW_CREATED: 'workflow.created',
  WORKFLOW_UPDATED: 'workflow.updated',
  WORKFLOW_PUBLISHED: 'workflow.published',
  WORKFLOW_PAUSED: 'workflow.paused',
  WORKFLOW_RESUMED: 'workflow.resumed',
  WORKFLOW_DELETED: 'workflow.deleted',
  TEMPLATE_CREATED: 'template.created',
  TEMPLATE_UPDATED: 'template.updated',
  TEMPLATE_DELETED: 'template.deleted',
  EXECUTION_RUN_STARTED: 'execution.run.started',
  EXECUTION_RUN_COMPLETED: 'execution.run.completed',
  EXECUTION_RUN_SKIPPED: 'execution.run.skipped',
  EXECUTION_RUN_FAILED: 'execution.run.failed',
  OUTBOUND_ACTION_SENT: 'outbound.action.sent',
  OUTBOUND_ACTION_FAILED: 'outbound.action.failed',
  OUTBOUND_ACTION_RECONCILED: 'outbound.action.reconciled',
  KEY_ROTATED: 'crypto.key.rotated',
} as const;

export interface AuditEntry {
  action: string;
  actorId?: string | null;
  actorType?: 'owner' | 'cli' | 'system';
  entity?: string;
  entityId?: string;
  outcome?: 'success' | 'failure';
  meta?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}
