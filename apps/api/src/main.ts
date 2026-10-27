import './load-env.js';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { serverEnv } from './common/config/env.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.use(cookieParser());
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', serverEnv.TRUST_PROXY_HOPS);
  app.setGlobalPrefix('api/v1', { exclude: ['healthz', 'readyz'] });
  app.enableShutdownHooks();

  await app.listen(serverEnv.API_PORT, '0.0.0.0');
}

void bootstrap();
