import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import type { MetaConfigDto } from '../meta/dto.js';
import { MetaConfigService } from '../meta/meta-config.service.js';
import { AdminOrgsQueryDto, UpdateTrackingSettingsDto } from './dto.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 14;

/**
 * Phase 3 — cross-tenant (unscoped) read models for the platform-admin
 * dashboard. Every method intentionally spans ALL organizations: routes are
 * `@Unscoped()`, so the ALS store is not bound and the Prisma tenancy
 * extension applies no filter. Authorization is enforced upstream by
 * PlatformAdminGuard — never expose this service to tenant-scoped routes.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metaConfig: MetaConfigService,
  ) {}

  /** Platform KPIs + a 14-day comment trend + the newest organizations. */
  async overview() {
    const now = Date.now();
    const cutoff30 = new Date(now - 30 * DAY_MS);
    const trendSince = new Date(now - (TREND_DAYS - 1) * DAY_MS);
    trendSince.setUTCHours(0, 0, 0, 0);

    const [
      orgCount,
      onboardedCount,
      ownerCount,
      assetCount,
      comments30,
      runs30,
      runs30Succeeded,
      publishedWorkflows,
      commentRows,
      latestOrgs,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.organization.count({
        where: { onboardingStep: 'done', onboardingCompletedAt: { not: null } },
      }),
      this.prisma.ownerAccount.count(),
      this.prisma.metaConnectedAsset.count(),
      this.prisma.commentEvent.count({ where: { receivedAt: { gte: cutoff30 } } }),
      this.prisma.executionRun.count({ where: { startedAt: { gte: cutoff30 } } }),
      this.prisma.executionRun.count({
        where: { startedAt: { gte: cutoff30 }, status: 'succeeded' },
      }),
      this.prisma.workflow.count({ where: { status: 'published' } }),
      this.prisma.commentEvent.findMany({
        where: { receivedAt: { gte: trendSince } },
        select: { receivedAt: true },
      }),
      this.prisma.organization.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          status: true,
          onboardingStep: true,
          createdAt: true,
          memberships: { take: 1, select: { user: { select: { username: true } } } },
        },
      }),
    ]);

    return {
      counts: {
        organizations: orgCount,
        onboardedOrganizations: onboardedCount,
        owners: ownerCount,
        assets: assetCount,
        comments30d: comments30,
        runs30d: runs30,
        publishedWorkflows,
        runSuccessRate30d:
          runs30 === 0 ? null : Math.round((runs30Succeeded / runs30) * 1000) / 10,
      },
      commentTrend: this.bucketDaily(commentRows.map((r) => r.receivedAt), trendSince),
      latestOrgs: latestOrgs.map((o) => ({
        id: o.id,
        name: o.name,
        status: o.status,
        onboardingStep: o.onboardingStep,
        createdAt: o.createdAt,
        ownerUsername: o.memberships[0]?.user.username ?? null,
      })),
    };
  }

  /** Offset-paginated organization list with search + per-org activity counts. */
  async listOrgs(query: AdminOrgsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const q = query.q?.trim();

    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            {
              memberships: {
                some: {
                  user: { username: { contains: q, mode: 'insensitive' as const } },
                },
              },
            },
          ],
        }
      : {};

    const [total, items] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          status: true,
          onboardingStep: true,
          onboardingCompletedAt: true,
          createdAt: true,
          memberships: { take: 1, select: { user: { select: { username: true } } } },
          _count: { select: { assets: true, workflows: true, comments: true } },
        },
      }),
    ]);

    return {
      items: items.map((o) => ({
        id: o.id,
        name: o.name,
        status: o.status,
        onboardingStep: o.onboardingStep,
        onboardingCompletedAt: o.onboardingCompletedAt,
        createdAt: o.createdAt,
        ownerUsername: o.memberships[0]?.user.username ?? null,
        counts: {
          assets: o._count.assets,
          workflows: o._count.workflows,
          comments: o._count.comments,
        },
      })),
      total,
      page,
      limit,
    };
  }

  /** Full cross-tenant detail for one organization. 404 for unknown ids. */
  async orgDetail(id: string) {
    if (!UUID_RE.test(id)) throw new NotFoundException();

    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        onboardingStep: true,
        onboardingCompletedAt: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          orderBy: { createdAt: 'asc' },
          select: {
            role: true,
            createdAt: true,
            user: { select: { id: true, username: true, email: true, createdAt: true } },
          },
        },
        assets: {
          select: {
            id: true,
            platform: true,
            displayName: true,
            connectionStatus: true,
            selected: true,
            connectedAt: true,
          },
          orderBy: { connectedAt: 'desc' },
        },
        workflows: {
          select: { id: true, name: true, status: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
        },
        templates: {
          select: { id: true, name: true, version: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { posts: true, comments: true, runs: true } },
      },
    });
    if (!org) throw new NotFoundException();

    const [runsSucceeded, recentAudit] = await Promise.all([
      this.prisma.executionRun.count({
        where: { organizationId: id, status: 'succeeded' },
      }),
      this.prisma.auditLog.findMany({
        where: { organizationId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          outcome: true,
          actorId: true,
          createdAt: true,
        },
      }),
    ]);

    const { memberships, ...rest } = org;
    return {
      ...rest,
      owners: memberships,
      runsSucceeded,
      recentAudit,
    };
  }

  /**
   * Buckets timestamps into one row per UTC day over [since, now], filling
   * empty days with zero so charts render a continuous series.
   */
  private bucketDaily(timestamps: Date[], since: Date) {
    const counts = new Map<string, number>();
    for (const ts of timestamps) {
      const key = ts.toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const days: Array<{ day: string; count: number }> = [];
    for (let i = 0; i < TREND_DAYS; i++) {
      const key = new Date(since.getTime() + i * DAY_MS).toISOString().slice(0, 10);
      days.push({ day: key, count: counts.get(key) ?? 0 });
    }
    return days;
  }

  /** Retrieve public Meta App configuration. */
  async getMetaConfig() {
    return this.metaConfig.getPublicConfig();
  }

  /** Update Meta App configuration with secure encryption. */
  async updateMetaConfig(dto: MetaConfigDto) {
    return this.metaConfig.update(dto);
  }

  /** Retrieve marketing and analytics tracking pixels configuration. */
  async getTrackingSettings() {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: 'tracking_pixels' },
    });
    if (!row || !row.value) {
      return {
        enabled: false,
        facebookPixelId: '',
        googleAnalyticsId: '',
        googleTagManagerId: '',
        tiktokPixelId: '',
        snapchatPixelId: '',
        customHeadScripts: '',
        customBodyScripts: '',
      };
    }
    const val = row.value as Record<string, unknown>;
    return {
      enabled: Boolean(val.enabled),
      facebookPixelId: (val.facebookPixelId as string) || '',
      googleAnalyticsId: (val.googleAnalyticsId as string) || '',
      googleTagManagerId: (val.googleTagManagerId as string) || '',
      tiktokPixelId: (val.tiktokPixelId as string) || '',
      snapchatPixelId: (val.snapchatPixelId as string) || '',
      customHeadScripts: (val.customHeadScripts as string) || '',
      customBodyScripts: (val.customBodyScripts as string) || '',
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Update marketing and analytics tracking pixels configuration. */
  async updateTrackingSettings(dto: UpdateTrackingSettingsDto) {
    const existing = await this.prisma.systemSetting.findUnique({
      where: { key: 'tracking_pixels' },
    });
    const currentVal = (existing?.value as Record<string, unknown>) || {};
    const merged = {
      ...currentVal,
      ...dto,
    };
    return this.prisma.systemSetting.upsert({
      where: { key: 'tracking_pixels' },
      create: {
        key: 'tracking_pixels',
        value: merged,
      },
      update: {
        value: merged,
      },
    });
  }
}
