import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.module.js';

export interface NormalizedComment {
  assetExternalId: string;
  platform: 'facebook' | 'instagram';
  externalPostId?: string;
  externalCommentId: string;
  parentCommentId?: string | null;
  authorScopedId: string;
  authorUsername?: string | null;
  text: string;
  sourceCreatedAt: Date;
  dedupeKey: string;
}

function asString(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  return fallback;
}

@Injectable()
export class NormalizationService {
  private readonly logger = new Logger(NormalizationService.name);
  private commentHooks: Array<(commentEventId: string) => Promise<void>> = [];

  constructor(private readonly prisma: PrismaService) {}

  registerCommentHook(hook: (commentEventId: string) => Promise<void>): void {
    this.commentHooks.push(hook);
  }

  /** Extract normalized comment entries from an arbitrary webhook entry. */
  extractComments(objectType: string, entry: Record<string, unknown>): NormalizedComment[] {
    const results: NormalizedComment[] = [];
    const entryId = asString(entry.id);
    const entryTimeSeconds = typeof entry.time === 'number' ? entry.time : Math.floor(Date.now() / 1000);
    const changes = Array.isArray(entry.changes) ? (entry.changes as Record<string, unknown>[]) : [];

    for (const change of changes) {
      const field = asString(change.field);
      const value = (change.value ?? {}) as Record<string, unknown>;

      // 1. Facebook Page feed comment event
      if (objectType === 'page' && field === 'feed') {
        const item = asString(value.item);
        const verb = asString(value.verb);
        const commentId = asString(value.comment_id ?? value.id);

        // We process comments with verb "add" (ignoring reactions, statuses, or deleted comments)
        if ((item === 'comment' || !item) && (verb === 'add' || !verb) && commentId) {
          const postId = value.post_id ? asString(value.post_id) : undefined;
          const parentId = value.parent_id ? asString(value.parent_id) : undefined;
          const isReply = parentId && parentId !== postId;
          const from = value.from as { id?: unknown; name?: unknown } | undefined;
          const authorId = asString(from?.id ?? value.sender_id, 'unknown');
          const authorName = from?.name ? asString(from.name) : value.sender_name ? asString(value.sender_name) : null;
          const text = asString(value.message);
          const createdTime = typeof value.created_time === 'number'
            ? value.created_time
            : entryTimeSeconds;

          results.push({
            assetExternalId: entryId,
            platform: 'facebook',
            externalPostId: postId,
            externalCommentId: commentId,
            parentCommentId: isReply ? parentId : null,
            authorScopedId: authorId,
            authorUsername: authorName,
            text,
            sourceCreatedAt: new Date(createdTime * 1000),
            dedupeKey: `facebook:${commentId}:add`,
          });
        }
      }

      // 2. Instagram comments event
      if (objectType === 'instagram' && field === 'comments') {
        const commentId = asString(value.id);
        if (commentId) {
          const media = value.media as { id?: unknown } | undefined;
          const from = value.from as { id?: unknown; username?: unknown } | undefined;
          const authorId = asString(from?.id, 'unknown');
          const authorUsername = value.username ? asString(value.username) : from?.username ? asString(from.username) : null;
          const text = asString(value.text);
          const parentId = value.parent_id ? asString(value.parent_id) : undefined;

          results.push({
            assetExternalId: entryId,
            platform: 'instagram',
            externalPostId: media?.id ? asString(media.id) : undefined,
            externalCommentId: commentId,
            parentCommentId: parentId ?? null,
            authorScopedId: authorId,
            authorUsername: authorUsername,
            text,
            sourceCreatedAt: new Date(entryTimeSeconds * 1000),
            dedupeKey: `instagram:${commentId}:add`,
          });
        }
      }
    }

    return results;
  }

  /**
   * Normalizes a WebhookDelivery record idempotently.
   * Updates delivery status to 'processed' or 'skipped'.
   */
  async normalizeDelivery(deliveryId: string): Promise<{ commentsCreated: number; skipped: boolean }> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      this.logger.warn(`WebhookDelivery not found: ${deliveryId}`);
      return { commentsCreated: 0, skipped: true };
    }

    const payload = (delivery.payload ?? {}) as Record<string, unknown>;
    const normalized = this.extractComments(delivery.objectType, payload);

    if (normalized.length === 0) {
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: { processStatus: 'skipped' },
      });
      return { commentsCreated: 0, skipped: true };
    }

    let commentsCreated = 0;
    for (const item of normalized) {
      const created = await this.persistComment(item, delivery.id);
      if (created) commentsCreated += 1;
    }

    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { processStatus: 'processed' },
    });

    return { commentsCreated, skipped: false };
  }

  /** Idempotently persist post (if any) and comment event. */
  async persistComment(item: NormalizedComment, rawPayloadRef?: string): Promise<boolean> {
    // 1. Resolve connected asset
    const asset = await this.prisma.metaConnectedAsset.findUnique({
      where: { externalId: item.assetExternalId },
    });

    if (!asset) {
      this.logger.warn(`No connected asset matching externalId: ${item.assetExternalId}`);
      return false;
    }

    // 2. Ensure post exists if postId is present
    let postRecordId: string | undefined = undefined;
    if (item.externalPostId) {
      const post = await this.prisma.post.upsert({
        where: {
          platform_externalId: {
            platform: item.platform,
            externalId: item.externalPostId,
          },
        },
        create: {
          assetId: asset.id,
          externalId: item.externalPostId,
          platform: item.platform,
          createdTime: item.sourceCreatedAt,
          isEligibleForReply: true,
        },
        update: {},
      });
      postRecordId = post.id;
    }

    // 3. Insert CommentEvent idempotently
    try {
      const created = await this.prisma.commentEvent.create({
        data: {
          assetId: asset.id,
          postId: postRecordId,
          platform: item.platform,
          externalCommentId: item.externalCommentId,
          parentCommentId: item.parentCommentId,
          authorScopedId: item.authorScopedId,
          authorUsername: item.authorUsername,
          text: item.text,
          sourceCreatedAt: item.sourceCreatedAt,
          rawPayloadRef: rawPayloadRef ?? null,
          dedupeKey: item.dedupeKey,
          direction: 'inbound',
        },
      });

      for (const hook of this.commentHooks) {
        hook(created.id).catch((err: unknown) => {
          this.logger.error(`Error in comment hook: ${(err as Error).message}`);
        });
      }

      return true;
    } catch (err: unknown) {
      // Unique constraint violation on dedupeKey means already inserted
      const errorStr = String(err);
      if (errorStr.includes('Unique constraint') || errorStr.includes('dedupe_key') || errorStr.includes('P2002')) {
        return false;
      }
      throw err;
    }
  }
}
