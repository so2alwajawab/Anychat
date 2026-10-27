import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { RedisService } from '../../common/redis/redis.module.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import { GraphApiError, GraphClient } from './graph.client.js';

const SIG_FAILURES_TOTAL = 'webhook:sig_failures';
const SIG_FAILURES_24H = 'webhook:sig_failures:24h';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly graph: GraphClient,
    private readonly audit: AuditService,
  ) {}

  async subscribePage(assetId: string, externalId: string, pageToken: string, fields: string[], actorId?: string): Promise<{ ok: boolean; code?: number }> {
    try {
      await this.graph.subscribePage(externalId, pageToken, fields);
      await this.prisma.webhookSubscription.upsert({
        where: { assetId_object: { assetId, object: 'page' } },
        update: {
          subscriptionStatus: 'active',
          subscribedFields: fields,
          lastVerifiedAt: new Date(),
          diagnostics: {},
        },
        create: {
          assetId,
          object: 'page',
          subscribedFields: fields,
          subscriptionStatus: 'active',
          lastVerifiedAt: new Date(),
          diagnostics: {},
        },
      });
      await this.audit.record({
        action: AUDIT_ACTIONS.META_SUBSCRIPTION_SET,
        actorId,
        entity: 'webhook_subscription',
        entityId: assetId,
        meta: { object: 'page', status: 'active', fields },
      });
      return { ok: true };
    } catch (err) {
      const code = err instanceof GraphApiError ? err.code : 0;
      const message = err instanceof Error ? err.message : 'unknown';
      await this.prisma.webhookSubscription.upsert({
        where: { assetId_object: { assetId, object: 'page' } },
        update: {
          subscriptionStatus: 'failed',
          subscribedFields: fields,
          lastVerifiedAt: new Date(),
          diagnostics: { errorCode: code, errorMessage: message.slice(0, 300) },
        },
        create: {
          assetId,
          object: 'page',
          subscribedFields: fields,
          subscriptionStatus: 'failed',
          lastVerifiedAt: new Date(),
          diagnostics: { errorCode: code, errorMessage: message.slice(0, 300) },
        },
      });
      return { ok: false, code };
    }
  }

  async recordInstagramDashboard(assetId: string, fields: string[], actorId?: string): Promise<void> {
    await this.prisma.webhookSubscription.upsert({
      where: { assetId_object: { assetId, object: 'instagram' } },
      update: {
        subscriptionStatus: 'dashboard_required',
        subscribedFields: fields,
        lastVerifiedAt: new Date(),
      },
      create: {
        assetId,
        object: 'instagram',
        subscribedFields: fields,
        subscriptionStatus: 'dashboard_required',
        lastVerifiedAt: new Date(),
        diagnostics: {
          note: 'IG webhooks are subscribed at app level via the Meta App Dashboard',
        },
      },
    });
    await this.audit.record({
      action: AUDIT_ACTIONS.META_SUBSCRIPTION_SET,
      actorId,
      entity: 'webhook_subscription',
      entityId: assetId,
      meta: { object: 'instagram', status: 'dashboard_required', fields },
    });
  }

  async touchLastEvent(objectType: string): Promise<void> {
    const object = objectType === 'instagram' ? 'instagram' : 'page';
    await this.prisma.webhookSubscription.updateMany({
      where: { object },
      data: { lastEventAt: new Date() },
    });
  }

  async incrementSignatureFailures(): Promise<void> {
    await this.redis.client.incr(SIG_FAILURES_TOTAL);
    await this.redis.incrementWithTtl(SIG_FAILURES_24H, 24 * 60 * 60);
  }

  async diagnostics() {
    const subscriptions = await this.prisma.webhookSubscription.findMany({
      include: { asset: { select: { id: true, displayName: true, platform: true, externalId: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const [totalRaw, last24hRaw] = await Promise.all([
      this.redis.client.get(SIG_FAILURES_TOTAL),
      this.redis.client.get(SIG_FAILURES_24H),
    ]);
    const lastEventAt = subscriptions.reduce<Date | null>((max, sub) => {
      if (sub.lastEventAt && (!max || sub.lastEventAt > max)) return sub.lastEventAt;
      return max;
    }, null);
    return {
      signatureFailures: {
        total: Number(totalRaw ?? 0),
        last24h: Number(last24hRaw ?? 0),
      },
      lastEventAt,
      subscriptions: subscriptions.map((sub) => ({
        id: sub.id,
        assetId: sub.assetId,
        assetName: sub.asset.displayName,
        assetPlatform: sub.asset.platform,
        assetExternalId: sub.asset.externalId,
        object: sub.object,
        subscribedFields: sub.subscribedFields,
        subscriptionStatus: sub.subscriptionStatus,
        lastEventAt: sub.lastEventAt,
        lastVerifiedAt: sub.lastVerifiedAt,
        diagnostics: sub.diagnostics ?? {},
      })),
    };
  }
}
