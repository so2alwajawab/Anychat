import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { REDACT_LOG_FIELDS } from '@anychat/shared';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { RedisModule } from './common/redis/redis.module.js';
import { AdminAuthGuard } from './common/guards/admin-auth.guard.js';
import { CsrfGuard } from './common/guards/csrf.guard.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { serverEnv } from './common/config/env.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MetaModule } from './modules/meta/meta.module.js';
import { ContentModule } from './modules/content/content.module.js';
import { TemplatesModule } from './modules/templates/templates.module.js';
import { WorkflowsModule } from './modules/workflows/workflows.module.js';
import { ExecutionModule } from './modules/execution/execution.module.js';

const isDev = serverEnv.NODE_ENV === 'development';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: serverEnv.LOG_LEVEL,
        redact: { paths: REDACT_LOG_FIELDS, censor: '[REDACTED]' },
        autoLogging: {
          ignore: (req) => req.url === '/healthz' || req.url === '/readyz',
        },
        serializers: {
          req(req: { method: string; url: string; remoteAddress?: string }) {
            return { method: req.method, url: req.url, remoteAddress: req.remoteAddress };
          },
          res(res: { statusCode: number }) {
            return { statusCode: res.statusCode };
          },
        },
        ...(isDev
          ? {}
          : {
              transport: {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
              },
            }),
      },
    }),
    PrismaModule,
    RedisModule,
    AuditModule,
    AuthModule,
    HealthModule,
    MetaModule,
    ContentModule,
    TemplatesModule,
    WorkflowsModule,
    ExecutionModule,
  ],
  providers: [
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true, transform: true }) },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: AdminAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
