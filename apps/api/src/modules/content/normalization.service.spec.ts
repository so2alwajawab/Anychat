import { describe, expect, it, vi } from 'vitest';
import { NormalizationService } from './normalization.service.js';
import type { PrismaService } from '../../common/prisma/prisma.module.js';

describe('NormalizationService', () => {
  const fakePrisma = {
    webhookDelivery: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    metaConnectedAsset: {
      findUnique: vi.fn(),
    },
    post: {
      upsert: vi.fn(),
    },
    commentEvent: {
      create: vi.fn(),
    },
  } as unknown as PrismaService;

  const service = new NormalizationService(fakePrisma);

  it('extracts Facebook Page comments correctly from feed changes', () => {
    const entry = {
      id: 'page_123',
      time: 1700000000,
      changes: [
        {
          field: 'feed',
          value: {
            item: 'comment',
            verb: 'add',
            comment_id: 'c_999',
            post_id: 'page_123_p_888',
            message: 'بكام السعر؟',
            from: { id: 'user_456', name: 'أحمد علي' },
            created_time: 1700000005,
          },
        },
      ],
    };

    const results = service.extractComments('page', entry);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      assetExternalId: 'page_123',
      platform: 'facebook',
      externalPostId: 'page_123_p_888',
      externalCommentId: 'c_999',
      parentCommentId: null,
      authorScopedId: 'user_456',
      authorUsername: 'أحمد علي',
      text: 'بكام السعر؟',
      sourceCreatedAt: new Date(1700000005 * 1000),
      dedupeKey: 'facebook:c_999:add',
    });
  });

  it('detects Facebook reply to another comment', () => {
    const entry = {
      id: 'page_123',
      time: 1700000000,
      changes: [
        {
          field: 'feed',
          value: {
            item: 'comment',
            verb: 'add',
            comment_id: 'c_child',
            parent_id: 'c_parent',
            post_id: 'page_123_p_888',
            message: 'رد على تعليق',
            sender_id: 'user_777',
            sender_name: 'سارة',
          },
        },
      ],
    };

    const results = service.extractComments('page', entry);
    expect(results).toHaveLength(1);
    expect(results[0]?.parentCommentId).toBe('c_parent');
  });

  it('ignores Facebook non-comment items like likes or photo uploads', () => {
    const entry = {
      id: 'page_123',
      changes: [
        {
          field: 'feed',
          value: { item: 'like', verb: 'add', post_id: 'p_1' },
        },
        {
          field: 'feed',
          value: { item: 'status', verb: 'add' },
        },
      ],
    };

    const results = service.extractComments('page', entry);
    expect(results).toHaveLength(0);
  });

  it('extracts Instagram comments correctly', () => {
    const entry = {
      id: 'ig_user_123',
      time: 1700000000,
      changes: [
        {
          field: 'comments',
          value: {
            id: 'ig_c_555',
            text: 'مهتم بالتفاصيل',
            from: { id: 'ig_author_1' },
            username: 'customer_ig',
            media: { id: 'media_999' },
            parent_id: 'ig_parent_1',
          },
        },
      ],
    };

    const results = service.extractComments('instagram', entry);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      assetExternalId: 'ig_user_123',
      platform: 'instagram',
      externalPostId: 'media_999',
      externalCommentId: 'ig_c_555',
      parentCommentId: 'ig_parent_1',
      authorScopedId: 'ig_author_1',
      authorUsername: 'customer_ig',
      text: 'مهتم بالتفاصيل',
      sourceCreatedAt: new Date(1700000000 * 1000),
      dedupeKey: 'instagram:ig_c_555:add',
    });
  });
});
