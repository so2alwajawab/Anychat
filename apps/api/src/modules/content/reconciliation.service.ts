import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { AssetsService } from '../meta/assets.service.js';
import { GraphClient } from '../meta/graph.client.js';
import { NormalizationService } from './normalization.service.js';

export interface SyncStats {
  assetId: string;
  platform: string;
  postsSynced: number;
  commentsSynced: number;
  newCommentsCount: number;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    private readonly graph: GraphClient,
    private readonly normalizer: NormalizationService,
  ) {}

  /**
   * Reconcile/backfill content for a specific asset by querying Meta Graph API.
   */
  async syncAsset(assetId: string): Promise<SyncStats> {
    const asset = await this.prisma.metaConnectedAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    const token = await this.assets.decryptToken(asset.id);
    let postsSynced = 0;
    let commentsSynced = 0;
    let newCommentsCount = 0;

    if (asset.platform === 'facebook') {
      const posts = await this.graph.listPagePosts(asset.externalId, token, 25);
      for (const p of posts) {
        postsSynced += 1;
        const post = await this.prisma.post.upsert({
          where: {
            platform_externalId: {
              platform: 'facebook',
              externalId: p.id,
            },
          },
          create: {
            assetId: asset.id,
            organizationId: asset.organizationId,
            externalId: p.id,
            platform: 'facebook',
            messagePreview: p.message ?? null,
            permalink: p.permalink ?? null,
            createdTime: new Date(p.createdTime),
            isEligibleForReply: true,
          },
          update: {
            messagePreview: p.message ?? null,
            permalink: p.permalink ?? null,
            syncedAt: new Date(),
          },
        });

        // Sync comments for this post
        try {
          const comments = await this.graph.listPagePostComments(p.id, token, 50);
          for (const c of comments) {
            commentsSynced += 1;
            const created = await this.normalizer.persistComment({
              assetExternalId: asset.externalId,
              platform: 'facebook',
              externalPostId: post.externalId,
              externalCommentId: c.id,
              parentCommentId: c.parentId ?? null,
              authorScopedId: c.authorId,
              authorUsername: c.authorUsername ?? null,
              text: c.text,
              sourceCreatedAt: new Date(c.createdTime),
              dedupeKey: `facebook:${c.id}:add`,
            });
            if (created) newCommentsCount += 1;
          }
        } catch (err) {
          this.logger.warn(`Failed to fetch comments for FB post ${p.id}: ${(err as Error).message}`);
        }
      }
    } else if (asset.platform === 'instagram') {
      const mediaList = await this.graph.listInstagramMedia(asset.externalId, token, 25);
      for (const m of mediaList) {
        postsSynced += 1;
        const post = await this.prisma.post.upsert({
          where: {
            platform_externalId: {
              platform: 'instagram',
              externalId: m.id,
            },
          },
          create: {
            assetId: asset.id,
            organizationId: asset.organizationId,
            externalId: m.id,
            platform: 'instagram',
            messagePreview: m.message ?? null,
            permalink: m.permalink ?? null,
            createdTime: new Date(m.createdTime),
            isEligibleForReply: true,
          },
          update: {
            messagePreview: m.message ?? null,
            permalink: m.permalink ?? null,
            syncedAt: new Date(),
          },
        });

        // Sync comments for this media
        try {
          const comments = await this.graph.listInstagramMediaComments(m.id, token, 50);
          for (const c of comments) {
            commentsSynced += 1;
            const created = await this.normalizer.persistComment({
              assetExternalId: asset.externalId,
              platform: 'instagram',
              externalPostId: post.externalId,
              externalCommentId: c.id,
              parentCommentId: c.parentId ?? null,
              authorScopedId: c.authorId,
              authorUsername: c.authorUsername ?? null,
              text: c.text,
              sourceCreatedAt: new Date(c.createdTime),
              dedupeKey: `instagram:${c.id}:add`,
            });
            if (created) newCommentsCount += 1;
          }
        } catch (err) {
          this.logger.warn(`Failed to fetch comments for IG media ${m.id}: ${(err as Error).message}`);
        }
      }
    }

    return {
      assetId: asset.id,
      platform: asset.platform,
      postsSynced,
      commentsSynced,
      newCommentsCount,
    };
  }

  /**
   * Sync all active and selected connected assets.
   */
  async syncAllSelected(): Promise<SyncStats[]> {
    const assets = await this.prisma.metaConnectedAsset.findMany({
      where: {
        connectionStatus: 'connected',
        selected: true,
      },
    });

    const results: SyncStats[] = [];
    for (const asset of assets) {
      try {
        const stats = await this.syncAsset(asset.id);
        results.push(stats);
      } catch (err) {
        this.logger.error(`Reconciliation failed for asset ${asset.id}: ${(err as Error).message}`);
      }
    }
    return results;
  }
}
