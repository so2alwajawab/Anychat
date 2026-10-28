import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import type { PrismaService } from '../../common/prisma/prisma.module.js';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    organization: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    ownerAccount: { count: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    metaConnectedAsset: { count: vi.fn() },
    commentEvent: { count: vi.fn(), findMany: vi.fn() },
    executionRun: { count: vi.fn() },
    workflow: { count: vi.fn() },
    auditLog: { findMany: vi.fn() },
    ...overrides,
  };
}

describe('AdminService (Phase 3)', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let service: AdminService;

  beforeEach(() => {
    prisma = mockPrisma();
    service = new AdminService(prisma as unknown as PrismaService);
  });

  it('overview aggregates cross-tenant KPIs and computes success rate', async () => {
    prisma = mockPrisma({
      organization: {
        count: vi
          .fn()
          .mockResolvedValueOnce(4) // total orgs
          .mockResolvedValueOnce(2), // onboarded
        findMany: vi.fn().mockResolvedValue([
          {
            id: UUID_A,
            name: 'Org A',
            status: 'active',
            onboardingStep: 'done',
            createdAt: new Date('2026-10-01T00:00:00Z'),
            memberships: [{ user: { username: 'alice' } }],
          },
        ]),
      },
      ownerAccount: { count: vi.fn().mockResolvedValue(4), findMany: vi.fn(), update: vi.fn() },
      metaConnectedAsset: { count: vi.fn().mockResolvedValue(6) },
      commentEvent: {
        count: vi.fn().mockResolvedValue(120),
        findMany: vi.fn().mockResolvedValue([
          { receivedAt: new Date() }, // today
          { receivedAt: new Date() },
          { receivedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // yesterday
        ]),
      },
      executionRun: {
        count: vi
          .fn()
          .mockResolvedValueOnce(10) // total runs
          .mockResolvedValueOnce(8), // succeeded
      },
      workflow: { count: vi.fn().mockResolvedValue(3), findMany: vi.fn(), findUnique: vi.fn() },
      auditLog: { findMany: vi.fn() },
    });
    service = new AdminService(prisma as unknown as PrismaService);

    const result = await service.overview();

    expect(result.counts.organizations).toBe(4);
    expect(result.counts.onboardedOrganizations).toBe(2);
    expect(result.counts.owners).toBe(4);
    expect(result.counts.assets).toBe(6);
    expect(result.counts.comments30d).toBe(120);
    expect(result.counts.runs30d).toBe(10);
    expect(result.counts.runSuccessRate30d).toBe(80);
    expect(result.counts.publishedWorkflows).toBe(3);
    expect(result.commentTrend).toHaveLength(14);
    expect(result.commentTrend.reduce((s, d) => s + d.count, 0)).toBe(3);
    expect(result.latestOrgs[0]).toMatchObject({
      id: UUID_A,
      name: 'Org A',
      ownerUsername: 'alice',
    });
  });

  it('overview returns null success rate when there are no runs', async () => {
    // count is called for orgs(total), orgs(onboarded), owners is separate model;
    // executionRun.count resolves 0 for both calls.
    prisma.organization.count.mockResolvedValue(0);
    prisma.commentEvent.findMany.mockResolvedValue([]);
    prisma.executionRun.count.mockResolvedValue(0);
    prisma.organization.findMany.mockResolvedValue([]);

    const result = await service.overview();
    expect(result.counts.runSuccessRate30d).toBeNull();
  });

  it('listOrgs paginates with offset and returns shape {items,total,page,limit}', async () => {
    prisma.organization.count.mockResolvedValue(45);
    prisma.organization.findMany.mockResolvedValue([
      {
        id: UUID_A,
        name: 'Test Org',
        status: 'active',
        onboardingStep: 'done',
        onboardingCompletedAt: new Date('2026-10-20T00:00:00Z'),
        createdAt: new Date('2026-10-01T00:00:00Z'),
        memberships: [{ user: { username: 'bob' } }],
        _count: { assets: 2, workflows: 5, comments: 30 },
      },
    ]);

    const result = await service.listOrgs({ page: 3, limit: 20 });

    expect(result.total).toBe(45);
    expect(result.page).toBe(3);
    expect(result.limit).toBe(20);
    expect(result.items[0]).toMatchObject({
      id: UUID_A,
      ownerUsername: 'bob',
      counts: { assets: 2, workflows: 5, comments: 30 },
    });
    // Offset: page 3 × limit 20 → skip 40, take 20.
    expect(prisma.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
  });

  it('listOrgs passes the search filter against name OR owner username', async () => {
    prisma.organization.count.mockResolvedValue(1);
    prisma.organization.findMany.mockResolvedValue([]);

    await service.listOrgs({ q: '  echoes ', page: 1, limit: 20 });

    const call = prisma.organization.findMany.mock.calls[0][0] as {
      where: { OR: unknown[] };
    };
    expect(call.where.OR).toHaveLength(2);
    expect(JSON.stringify(call.where.OR)).toContain('echoes');
  });

  it('orgDetail 404s for malformed or unknown ids', async () => {
    await expect(service.orgDetail('not-a-uuid')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    prisma.organization.findUnique.mockResolvedValue(null);
    await expect(service.orgDetail(UUID_B)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('orgDetail returns members, counts, and recent audit for a found org', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      id: UUID_A,
      name: 'Org A',
      status: 'active',
      onboardingStep: 'done',
      onboardingCompletedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      memberships: [
        {
          role: 'owner',
          createdAt: new Date(),
          user: { id: UUID_B, username: 'alice', email: null, createdAt: new Date() },
        },
      ],
      assets: [],
      workflows: [],
      templates: [],
      _count: { posts: 3, comments: 9, runs: 4 },
    });
    prisma.executionRun.count.mockResolvedValue(4);
    prisma.auditLog.findMany.mockResolvedValue([
      { id: 'a1', action: 'workflow.published', outcome: 'success', actorId: UUID_B, createdAt: new Date() },
    ]);

    const result = await service.orgDetail(UUID_A);

    expect(result.name).toBe('Org A');
    expect(result.owners).toHaveLength(1);
    expect(result.owners[0].user.username).toBe('alice');
    expect(result._count).toEqual({ posts: 3, comments: 9, runs: 4 });
    expect(result.runsSucceeded).toBe(4);
    expect(result.recentAudit).toHaveLength(1);
    // The raw `memberships` key is renamed to `owners` (no duplicate).
    expect(result).not.toHaveProperty('memberships');
  });
});
