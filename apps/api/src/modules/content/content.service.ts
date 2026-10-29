import { HttpException, Injectable } from '@nestjs/common';
import { ERROR_CODES, apiError } from '@anychat/shared';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { ReconciliationService } from './reconciliation.service.js';
import type { ListCommentsQuery, ListContentQuery } from './dto.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliation: ReconciliationService,
  ) {}

  async listPosts(query: ListContentQuery) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10) || 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.assetId) where.assetId = query.assetId;
    if (query.platform) where.platform = query.platform;
    if (query.search) {
      where.messagePreview = { contains: query.search, mode: 'insensitive' };
    }

    const [total, items] = await Promise.all([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdTime: 'desc' },
        include: {
          asset: {
            select: {
              id: true,
              displayName: true,
              platform: true,
            },
          },
          _count: {
            select: { comments: true },
          },
        },
      }),
    ]);

    return {
      items: items.map((p) => ({
        id: p.id,
        assetId: p.assetId,
        assetName: p.asset.displayName,
        platform: p.platform,
        externalId: p.externalId,
        messagePreview: p.messagePreview,
        permalink: p.permalink,
        isEligibleForReply: p.isEligibleForReply,
        createdTime: p.createdTime.toISOString(),
        syncedAt: p.syncedAt.toISOString(),
        commentsCount: p._count.comments,
      })),
      total,
      page,
      limit,
    };
  }

  async listComments(query: ListCommentsQuery) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10) || 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.assetId) where.assetId = query.assetId;
    if (query.postId) where.postId = query.postId;
    if (query.platform) where.platform = query.platform;
    if (query.search) {
      where.text = { contains: query.search, mode: 'insensitive' };
    }

    const [total, items] = await Promise.all([
      this.prisma.commentEvent.count({ where }),
      this.prisma.commentEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sourceCreatedAt: 'desc' },
        include: {
          asset: {
            select: {
              id: true,
              displayName: true,
              platform: true,
            },
          },
          post: {
            select: {
              id: true,
              externalId: true,
              messagePreview: true,
              permalink: true,
            },
          },
        },
      }),
    ]);

    return {
      items: items.map((c) => ({
        id: c.id,
        assetId: c.assetId,
        assetName: c.asset.displayName,
        platform: c.platform,
        postId: c.postId,
        postPreview: c.post?.messagePreview ?? null,
        postPermalink: c.post?.permalink ?? null,
        externalCommentId: c.externalCommentId,
        parentCommentId: c.parentCommentId,
        authorScopedId: c.authorScopedId,
        authorUsername: c.authorUsername,
        text: c.text,
        sourceCreatedAt: c.sourceCreatedAt.toISOString(),
        receivedAt: c.receivedAt.toISOString(),
        direction: c.direction,
      })),
      total,
      page,
      limit,
    };
  }

  async getComment(id: string) {
    if (!UUID_PATTERN.test(id)) {
      throw new HttpException(apiError(404, ERROR_CODES.NOT_FOUND), 404);
    }
    const comment = await this.prisma.commentEvent.findUnique({
      where: { id },
      include: {
        asset: {
          select: {
            id: true,
            displayName: true,
            platform: true,
            externalId: true,
          },
        },
        post: true,
      },
    });

    if (!comment) {
      throw new HttpException(apiError(404, ERROR_CODES.NOT_FOUND), 404);
    }

    return {
      id: comment.id,
      assetId: comment.assetId,
      asset: comment.asset,
      platform: comment.platform,
      post: comment.post,
      externalCommentId: comment.externalCommentId,
      parentCommentId: comment.parentCommentId,
      authorScopedId: comment.authorScopedId,
      authorUsername: comment.authorUsername,
      text: comment.text,
      sourceCreatedAt: comment.sourceCreatedAt.toISOString(),
      receivedAt: comment.receivedAt.toISOString(),
      direction: comment.direction,
      dedupeKey: comment.dedupeKey,
    };
  }

  async sync(assetId?: string) {
    if (assetId) {
      const stats = await this.reconciliation.syncAsset(assetId);
      return { syncedAssets: 1, stats: [stats] };
    }
    const statsList = await this.reconciliation.syncAllSelected();
    return { syncedAssets: statsList.length, stats: statsList };
  }

  private readonly metadataStore = new Map<
    string,
    { postId: string; customerName?: string; imageUrl?: string; updatedAt: string }
  >();

  async savePostMetadata(body: { postId?: string; customerName?: string; imageUrl?: string }) {
    const postId = body.postId || 'default';
    const entry = {
      postId,
      customerName: body.customerName,
      imageUrl: body.imageUrl,
      updatedAt: new Date().toISOString(),
    };
    this.metadataStore.set(postId, entry);
    return { success: true, metadata: entry };
  }

  async getPostMetadata(postId?: string) {
    const key = postId || 'default';
    const entry = this.metadataStore.get(key) || {
      postId: key,
      customerName: '',
      imageUrl: '',
      updatedAt: new Date().toISOString(),
    };
    return { success: true, metadata: entry };
  }
}
