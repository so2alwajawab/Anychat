import { Controller, Get, HttpException } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator.js';
import { PrismaService } from '../../common/prisma/prisma.module.js';
import { RedisService } from '../../common/redis/redis.module.js';

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get('healthz')
  healthz() {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  @Public()
  @Get('readyz')
  async readyz() {
    const [dbOk, redisOk] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      this.redis.ping(),
    ]);
    const ready = dbOk && redisOk;
    const body = {
      statusCode: ready ? 200 : 503,
      code: ready ? 'READY' : 'NOT_READY',
      message: ready ? 'ok' : 'الخدمة غير جاهزة حالياً.',
      components: { database: dbOk ? 'ok' : 'down', redis: redisOk ? 'ok' : 'down' },
    };
    if (!ready) throw new HttpException(body, 503);
    return body;
  }

  @Public()
  @Get('system/tracking')
  async getPublicTracking() {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: 'tracking_pixels' },
    });
    if (!row || !row.value) {
      return { enabled: false };
    }
    const val = row.value as Record<string, unknown>;
    if (!val.enabled) {
      return { enabled: false };
    }
    return {
      enabled: true,
      facebookPixelId: (val.facebookPixelId as string) || null,
      googleAnalyticsId: (val.googleAnalyticsId as string) || null,
      googleTagManagerId: (val.googleTagManagerId as string) || null,
      tiktokPixelId: (val.tiktokPixelId as string) || null,
      snapchatPixelId: (val.snapchatPixelId as string) || null,
      customHeadScripts: (val.customHeadScripts as string) || null,
      customBodyScripts: (val.customBodyScripts as string) || null,
    };
  }
}
