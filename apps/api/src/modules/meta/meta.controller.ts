import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { API_ROUTES } from '@anychat/shared';
import { Public } from '../../common/decorators/public.decorator.js';
import { clearOauthStateCookie, setOauthStateCookie } from '../../common/cookies.js';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import { AuditService } from '../audit/audit.service.js';
import { AssetsService } from './assets.service.js';
import { MetaConfigDto, SelectAssetDto } from './dto.js';
import { MetaConfigService } from './meta-config.service.js';
import { OAUTH_STATE_COOKIE } from './meta.constants.js';
import { OauthService } from './oauth.service.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { WebhookService } from './webhook.service.js';

@Controller('meta')
export class MetaController {
  constructor(
    private readonly config: MetaConfigService,
    private readonly oauth: OauthService,
    private readonly assets: AssetsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly audit: AuditService,
    private readonly webhooks: WebhookService,
  ) {}

  @Get('config')
  getConfig() {
    return this.config.getPublicConfig();
  }

  @Put('config')
  @HttpCode(200)
  async updateConfig(@Body() dto: MetaConfigDto, @Req() req: Request) {
    const row = await this.config.update(dto);
    await this.audit.record(
      {
        action: AUDIT_ACTIONS.META_CONFIG_UPDATED,
        actorId: req.session?.ownerId,
        entity: 'meta_config',
        entityId: row.id,
        meta: {
          appId: row.appId,
          graphApiVersion: row.graphApiVersion,
          appsecretProofEnabled: row.appsecretProofEnabled,
          secretRotated: dto.appSecret !== undefined,
          verifyTokenRotated: dto.webhookVerifyToken !== undefined,
        },
      },
      req,
    );
    return this.config.getPublicConfig();
  }

  @Get('oauth/start')
  async oauthStart(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = req.session;
    const { state, authorizeUrl } = await this.oauth.start(session!.id, session!.ownerId);
    setOauthStateCookie(res, state);
    res.redirect(authorizeUrl);
  }

  @Public()
  @Get('oauth/callback')
  async oauthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const oauthCookie = req.cookies?.[OAUTH_STATE_COOKIE] as string | undefined;
    try {
      const { redirectUrl } = await this.oauth.handleCallback({ code, state, oauthCookie });
      clearOauthStateCookie(res);
      res.redirect(redirectUrl);
    } catch (err) {
      clearOauthStateCookie(res);
      throw err;
    }
  }

  @Get('assets')
  listAssets() {
    return this.assets.list();
  }

  @Get('assets/:id/health')
  assetHealth(@Param('id') id: string, @Req() req: Request) {
    return this.assets.health(id, req);
  }

  @Post('assets/:id/select')
  @HttpCode(200)
  selectAsset(@Param('id') id: string, @Body() dto: SelectAssetDto, @Req() req: Request) {
    return this.assets.select(id, dto.selected ?? true, req);
  }

  @Delete('assets/:id')
  @HttpCode(200)
  removeAsset(@Param('id') id: string, @Req() req: Request) {
    return this.assets.remove(id, req);
  }

  @Post('assets/:id/reconnect')
  @HttpCode(200)
  async reconnectAsset(@Param('id') id: string, @Req() req: Request) {
    await this.assets.health(id, req).catch(() => undefined);
    await this.audit.record(
      {
        action: AUDIT_ACTIONS.META_OAUTH_STARTED,
        actorId: req.session?.ownerId,
        entity: 'meta_asset',
        entityId: id,
        meta: { reconnect: true },
      },
      req,
    );
    return { redirectUrl: API_ROUTES.metaOauthStart };
  }

  @Get('webhooks/diagnostics')
  diagnostics() {
    return this.subscriptions.diagnostics();
  }

  @Get('webhooks/deliveries')
  deliveries(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));
    return this.webhooks.listDeliveries(pageNum, limitNum);
  }
}
