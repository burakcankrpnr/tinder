import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Redis } from 'ioredis';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { REDIS } from '../src/infra/redis/redis.module';
import { type MailMessage, MailService } from '../src/modules/mail/mail.service';

export class InMemoryMailService extends MailService {
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }

  lastTo(email: string): MailMessage | undefined {
    return [...this.sent].reverse().find((message) => message.to === email);
  }

  tokenFrom(email: string, pathname: string): string {
    const message = this.lastTo(email);
    const match = message?.text.match(new RegExp(`${pathname}\\?token=([A-Za-z0-9_-]+)`));
    if (!match?.[1]) throw new Error(`No ${pathname} token mailed to ${email}`);
    return match[1];
  }
}

export interface TestContext {
  app: NestExpressApplication;
  mail: InMemoryMailService;
  prisma: PrismaService;
  redis: Redis;
  reset: () => Promise<void>;
}

export async function createTestApp(): Promise<TestContext> {
  const mail = new InMemoryMailService();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true, rawBody: true });
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  const redis = app.get<Redis>(REDIS);

  const reset = async (): Promise<void> => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE analytics_events, verification_requests, payment_events, payments, checkout_sessions, subscriptions, entitlements, boosts, feature_overrides, devices, notifications, notification_preferences, reports, blocks, messages, conversations, matches, swipes, user_photos, user_interests, user_preferences, user_profiles, audit_logs, sessions, email_verification_tokens, password_reset_tokens, oauth_accounts, users CASCADE',
    );
    await redis.flushdb();
    mail.sent.length = 0;
  };

  return { app, mail, prisma, redis, reset };
}
