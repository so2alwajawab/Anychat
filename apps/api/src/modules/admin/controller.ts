import { Body, Controller, Get, HttpCode, Param, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  PlatformAdminOnly,
  Unscoped,
} from '../../common/decorators/platform-admin.decorator.js';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import { AuditService } from '../audit/audit.service.js';
import { MetaConfigDto } from '../meta/dto.js';
import { AdminService } from './admin.service.js';
import { AdminOrgsQueryDto, UpdateTrackingSettingsDto } from './dto.js';

/**
 * Phase 3 — platform-admin API (cross-tenant, read-only). The whole controller
 * is admin-gated and unscoped: PlatformAdminGuard enforces
 * `platformRole === 'admin'`, and OrgContextInterceptor skips tenant binding so
 * AdminService queries see every organization.
 */
@Controller('admin')
@PlatformAdminOnly()
@Unscoped()
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly audit: AuditService,
  ) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('orgs')
  listOrgs(@Query() query: AdminOrgsQueryDto) {
    return this.admin.listOrgs(query);
  }

  @Get('orgs/:id')
  async orgDetail(@Param('id') id: string, @Req() req: Request) {
    const detail = await this.admin.orgDetail(id);
    await this.audit.record(
      {
        action: AUDIT_ACTIONS.ADMIN_ORG_VIEWED,
        actorId: req.session?.ownerId ?? null,
        entity: 'organization',
        entityId: detail.id,
        organizationId: detail.id,
      },
      req,
    );
    return detail;
  }

  @Get('meta-config')
  getMetaConfig() {
    return this.admin.getMetaConfig();
  }

  @Put('meta-config')
  @HttpCode(200)
  async updateMetaConfig(@Body() dto: MetaConfigDto, @Req() req: Request) {
    const res = await this.admin.updateMetaConfig(dto);
    await this.audit.record(
      {
        action: AUDIT_ACTIONS.META_CONFIG_UPDATED,
        actorId: req.session?.ownerId ?? null,
        entity: 'meta_config',
        entityId: res.id,
        meta: {
          appId: res.appId,
          graphApiVersion: res.graphApiVersion,
          appsecretProofEnabled: res.appsecretProofEnabled,
          secretRotated: dto.appSecret !== undefined,
          verifyTokenRotated: dto.webhookVerifyToken !== undefined,
        },
      },
      req,
    );
    return res;
  }

  @Get('tracking')
  getTracking() {
    return this.admin.getTrackingSettings();
  }

  @Put('tracking')
  @HttpCode(200)
  async updateTracking(@Body() dto: UpdateTrackingSettingsDto, @Req() req: Request) {
    const res = await this.admin.updateTrackingSettings(dto);
    await this.audit.record(
      {
        action: 'admin.tracking.updated',
        actorId: req.session?.ownerId ?? null,
        entity: 'system_setting',
        entityId: 'tracking_pixels',
        meta: { enabled: dto.enabled },
      },
      req,
    );
    return res;
  }
}
