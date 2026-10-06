import path from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { ApiEnv } from '@dating/config';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { ENV } from './config/env.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, rawBody: true });
  configureApp(app);
  const env = app.get<ApiEnv>(ENV);
  await app.listen(env.API_PORT, '0.0.0.0');
}

void bootstrap();
