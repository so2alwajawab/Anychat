import { createHmac } from 'node:crypto';
import { HttpException, Injectable } from '@nestjs/common';
import { ERROR_CODES, apiError, timingSafeEqualString } from '@anychat/shared';
import { sha256Hex } from '../../common/crypto/hash.js';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { MetaConfigService } from './meta-config.service.js';
import { SubscriptionsService } from './subscriptions.service.js';

interface WebhookChange {
  field?: string;
  value?: Record<string, unknown>;
}

interface WebhookEntry {
  id?: string;
  time?: number;
  changes?: WebhookChange[];
}

interface WebhookPayload {
  object?: string;
  entry?: WebhookEntry[];
}

/** Canonical, stable hash used as the dedupe key for one delivery unit. */
export function computeDeliveryHash(payload: WebhookPayload, entry: WebhookEntry): string {
  const change = entry.changes?.[0];
  const value = change?.value ?? {};
  const canonical = JSON.stringify({
    object: payload.object ?? '',
    entryId: entry.id ?? '',
    time: entry.time ?? 0,
    field: change?.field ?? '',
    valueId:
      (value.id as string | undefined) ??
      (value.comment_id as string | undefined) ??
      (value.media_id as string | undefined) ??
      '',
    verb: (value.verb as string | undefined) ?? '',
  });
  return sha256Hex(canonical);
}

export function signatureValid(raw: Buffer, header: string | undefined, appSecret: string): boolean {
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', appSecret).update(raw).digest('hex')}`;
  return timingSafeEqualString(header, expected);
}

export type DeliveryHook = (id: string, deliveryHash: string) => Promise<void>;

@Injectable()
export class WebhookService {
  private readonly deliveryHooks: DeliveryHook[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: MetaConfigService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  registerDeliveryHook(hook: DeliveryHook): void {
    this.deliveryHooks.push(hook);
  }

  async verifyChallenge(provided: string | undefined): Promise<boolean> {
    let expected: string | null = null;
    try {
      const cfg = await this.config.requireConfig();
      expected = cfg.verifyToken;
    } catch {
      return false;
    }
    if (!expected || !provided) return false;
    return timingSafeEqualString(provided, expected);
  }

  async handleDelivery(
    raw: Buffer,
    signatureHeader: string | undefined,
  ): Promise<{ status: string; accepted: number; duplicates: number }> {
    let appSecret: string;
    try {
      const cfg = await this.config.requireConfig();
      appSecret = cfg.appSecret;
    } catch {
      throw new HttpException(apiError(503, ERROR_CODES.META_NOT_CONFIGURED), 503);
    }

    if (!signatureValid(raw, signatureHeader, appSecret)) {
      await this.subscriptions.incrementSignatureFailures();
      throw new HttpException(apiError(401, ERROR_CODES.WEBHOOK_SIGNATURE_INVALID), 401);
    }

    let payload: WebhookPayload;
    try {
      payload = JSON.parse(raw.toString('utf8')) as WebhookPayload;
    } catch {
      throw new HttpException(apiError(400, ERROR_CODES.VALIDATION_ERROR), 400);
    }

    const entries = Array.isArray(payload.entry) ? payload.entry : [];
    let accepted = 0;
    let duplicates = 0;
    for (const entry of entries) {
      const deliveryHash = computeDeliveryHash(payload, entry);
      try {
        const created = await this.prisma.webhookDelivery.create({
          data: {
            deliveryHash,
            objectType: payload.object ?? 'unknown',
            payload: entry as object,
            signatureStatus: 'valid',
            processStatus: 'received',
          },
        });
        accepted += 1;
        for (const hook of this.deliveryHooks) {
          try {
            await hook(created.id, deliveryHash);
          } catch {
            // Non-blocking: background ingestion continues
          }
        }
      } catch {
        duplicates += 1;
      }
    }

    if (accepted > 0) {
      await this.subscriptions.touchLastEvent(payload.object ?? 'page');
    }

    return { status: 'accepted', accepted, duplicates };
  }

  async countDeliveries(): Promise<number> {
    return this.prisma.webhookDelivery.count();
  }

  async listDeliveries(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      this.prisma.webhookDelivery.count(),
      this.prisma.webhookDelivery.findMany({
        skip,
        take: limit,
        orderBy: { receivedAt: 'desc' },
      }),
    ]);
    return {
      items: items.map((d) => ({
        id: d.id,
        deliveryHash: d.deliveryHash,
        objectType: d.objectType,
        signatureStatus: d.signatureStatus,
        processStatus: d.processStatus,
        receivedAt: d.receivedAt.toISOString(),
        payload: d.payload,
      })),
      total,
      page,
      limit,
    };
  }
}
