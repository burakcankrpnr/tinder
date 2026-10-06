import { randomUUID } from 'node:crypto';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import type { ApiEnv } from '@dating/config';
import type { Redis } from 'ioredis';
import { LoggerModule } from 'nestjs-pino';
import { ENV, EnvModule } from './config/env.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { REDIS, RedisModule } from './infra/redis/redis.module';
import { RedisThrottlerStorage } from './infra/redis/redis-throttler.storage';
import { ActivityModule } from './modules/activity/activity.module';
import { AdminModule } from './modules/admin/admin.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { VerificationModule } from './modules/verification/verification.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { EntitlementsModule } from './modules/billing/entitlements.module';
import { PremiumModule } from './modules/premium/premium.module';
import { ChatModule } from './modules/chat/chat.module';
import { MatchesModule } from './modules/matches/matches.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SafetyModule } from './modules/safety/safety.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { HealthController } from './modules/health/health.controller';
import { InterestsModule } from './modules/interests/interests.module';
import { MediaModule } from './modules/media/media.module';
import { MailModule } from './modules/mail/mail.module';
import { PhotosModule } from './modules/photos/photos.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { StorageModule } from './modules/storage/storage.module';
import { SwipesModule } from './modules/swipes/swipes.module';
import { UsersModule } from './modules/users/users.module';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

@Module({
  imports: [
    EnvModule,
    LoggerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: ApiEnv) => ({
        pinoHttp: {
          level: env.NODE_ENV === 'production' ? 'info' : env.NODE_ENV === 'test' ? 'silent' : 'debug',
          genReqId: (req, res) => {
            const incoming = req.headers['x-request-id'];
            const id =
              typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
                ? incoming
                : randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
              '*.password',
              '*.token',
              '*.accessToken',
              '*.refreshToken',
            ],
            censor: '[REDACTED]',
          },
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    ThrottlerModule.forRootAsync({
      inject: [REDIS],
      useFactory: (redis: Redis) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    BullModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: ApiEnv) => ({
        connection: { url: env.REDIS_URL, maxRetriesPerRequest: null },
        prefix: 'bull',
      }),
    }),
    EventEmitterModule.forRoot(),
    MailModule,
    AuditModule,
    StorageModule,
    AuthModule,
    UsersModule,
    ActivityModule,
    InterestsModule,
    MediaModule,
    PhotosModule,
    ProfilesModule,
    RealtimeModule,
    SafetyModule,
    NotificationsModule,
    DiscoveryModule,
    SwipesModule,
    MatchesModule,
    ChatModule,
    EntitlementsModule,
    BillingModule,
    PremiumModule,
    AnalyticsModule,
    FeatureFlagsModule,
    VerificationModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
