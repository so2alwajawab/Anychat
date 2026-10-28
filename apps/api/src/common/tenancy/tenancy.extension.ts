import { Prisma } from '../../generated/prisma/client.js';
import { currentOrgId } from './org-context.js';

/**
 * Models owned by a single tenant (organization). Every query on these models
 * is auto-scoped to the active organization by the extension below, so a
 * handler that forgets a filter reads its OWN rows (or none) — never another
 * tenant's.
 *
 * Names are the PascalCase Prisma model names (that is what the query hook
 * receives). `MetaCredential`, `WebhookSubscription`'s sibling credentials and
 * `OwnerAccount`/`OwnerSession`/`Membership`/`Organization` are deliberately
 * absent: credentials follow their asset (scoped transitively), and identity
 * tables are looked up globally (login/session) or are the tenancy boundary
 * itself.
 */
const TENANT_MODELS = new Set([
  'MetaConnectedAsset',
  'WebhookSubscription',
  'WebhookDelivery',
  'Post',
  'CommentEvent',
  'Workflow',
  'MessageTemplate',
  'ExecutionRun',
  'AuditLog',
]);

/** Operations whose args carry a `where` clause to scope. */
const WHERE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
  'upsert',
]);

/** Operations whose args carry a `data` payload to stamp. */
const CREATE_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'upsert',
]);

export const tenancyExtension = Prisma.defineExtension({
  name: 'tenancy',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const orgId = currentOrgId();
        // No active tenant context (background job, public webhook, CLI) or a
        // non-tenant model: run the query untouched. Those paths set
        // organizationId explicitly on writes.
        if (!orgId || !TENANT_MODELS.has(model)) {
          return query(args);
        }

        // Mutate args in place; cast to a loose record for uniform access across
        // the many operation-arg shapes, then hand the original (typed) args back
        // to query() so the client's inferred types are preserved.
        const next = args as Record<string, unknown> | undefined;

        if (next && WHERE_OPERATIONS.has(operation)) {
          // Scope even when the caller passed NO where clause (e.g.
          // `findMany({ orderBy })`), which is the common list() shape — those
          // would otherwise read every tenant's rows. And when a where IS
          // supplied, the context org wins over any caller filter so a crafted
          // `where` can never widen the scope past the tenant.
          const where =
            next.where && typeof next.where === 'object'
              ? (next.where as Record<string, unknown>)
              : {};
          next.where = { ...where, organizationId: orgId };
        }

        if (next && CREATE_OPERATIONS.has(operation)) {
          if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const rows = next.data as Array<Record<string, unknown>> | undefined;
            if (Array.isArray(rows)) {
              next.data = rows.map((row) => ({ ...row, organizationId: orgId }));
            }
          } else if (operation === 'upsert') {
            if (next.create && typeof next.create === 'object') {
              next.create = { ...(next.create as object), organizationId: orgId };
            }
          } else if (next.data && typeof next.data === 'object') {
            next.data = { ...(next.data as object), organizationId: orgId };
          }
        }

        return query(args);
      },
    },
  },
});

/** Re-export for callers that need the tenant model set (tests, tooling). */
export const TENANT_MODEL_NAMES = TENANT_MODELS;
