import { Controller, Get, HttpCode, HttpException, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ERROR_CODES, apiError } from '@anychat/shared';
import { Public } from '../../common/decorators/public.decorator.js';
import { clientIp } from '../../common/http-utils.js';
import { RedisService } from '../../common/redis/redis.module.js';
import { WEBHOOK_FLOOD_PER_MINUTE } from './meta.constants.js';
import { WebhookService } from './webhook.service.js';

@Public()
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooks: WebhookService,
    private readonly redis: RedisService,
  ) {}

  @Get('meta')
  async verify(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') verifyToken: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (mode !== 'subscribe' || !challenge) {
      throw new HttpException(apiError(400, ERROR_CODES.VALIDATION_ERROR), 400);
    }
    const ok = await this.webhooks.verifyChallenge(verifyToken);
    if (!ok) {
      throw new HttpException(apiError(403, ERROR_CODES.WEBHOOK_VERIFY_FAILED), 403);
    }
    res.status(200).type('text/plain').send(challenge);
  }

  @Post('meta')
  @HttpCode(200)
  async receive(@Req() req: Request) {
    const flood = await this.redis.incrementWithTtl(`webhook:flood:${clientIp(req)}`, 60);
    if (flood > WEBHOOK_FLOOD_PER_MINUTE) {
      throw new HttpException(apiError(429, ERROR_CODES.WEBHOOK_RATE_LIMITED), 429);
    }
    const raw = req.rawBody;
    if (!Buffer.isBuffer(raw)) {
      throw new HttpException(apiError(500, ERROR_CODES.INTERNAL_ERROR), 500);
    }
    const header = req.headers['x-hub-signature-256'];
    const signature = Array.isArray(header) ? header[0] : header;
    return this.webhooks.handleDelivery(raw, signature);
  }
}
