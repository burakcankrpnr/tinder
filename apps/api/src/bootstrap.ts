import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { ApiEnv } from '@dating/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { ENV } from './config/env.module';
import { AllExceptionsFilter } from './common/http/all-exceptions.filter';
import { ApiResponseInterceptor } from './common/http/api-response.interceptor';
import { allowedOrigins } from './common/http/cors';
import { RedisIoAdapter } from './modules/realtime/redis-io.adapter';

export const API_PREFIX = 'api/v1';

export function configureApp(app: NestExpressApplication): INestApplication {
  const env = app.get<ApiEnv>(ENV);

  app.useLogger(app.get(Logger));
  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: allowedOrigins(env),
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useWebSocketAdapter(new RedisIoAdapter(app, env));
  app.enableShutdownHooks();

  return app;
}
