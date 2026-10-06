import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ApiEnv } from '@dating/config';
import type { PushConfigDto } from '@dating/types';
import type { PushSubscriptionInput } from '@dating/validation';
import { WebPushError, sendNotification } from 'web-push';
import { z } from 'zod';
import { ENV } from '../../config/env.module';
import { PrismaService } from '../../infra/prisma/prisma.service';

const storedKeysSchema = z.object({ p256dh: z.string(), auth: z.string() });

export interface PushPayload {
  title: string;
  body: string;
  href: string | null;
  /** Aynı tag'li bildirimler tarayıcıda tek bildirimde birleşir. */
  tag: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly vapid: { publicKey: string; privateKey: string; subject: string } | null;

  constructor(
    @Inject(ENV) env: ApiEnv,
    private readonly prisma: PrismaService,
  ) {
    this.vapid =
      env.WEB_PUSH_PUBLIC_KEY && env.WEB_PUSH_PRIVATE_KEY
        ? {
            publicKey: env.WEB_PUSH_PUBLIC_KEY,
            privateKey: env.WEB_PUSH_PRIVATE_KEY,
            subject: env.WEB_PUSH_SUBJECT ?? 'mailto:support@dating.local',
          }
        : null;
  }

  config(): PushConfigDto {
    return { enabled: this.vapid !== null, publicKey: this.vapid?.publicKey ?? null };
  }

  /** Endpoint benzersizdir; aynı tarayıcı başka hesapla abone olursa kayıt yeni hesaba taşınır. */
  async subscribe(userId: string, input: PushSubscriptionInput, userAgent: string | null): Promise<void> {
    await this.prisma.device.upsert({
      where: { endpoint: input.endpoint },
      create: { userId, platform: 'WEB', endpoint: input.endpoint, keys: input.keys, userAgent },
      update: { userId, keys: input.keys, userAgent, lastSeenAt: new Date() },
    });
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.prisma.device.deleteMany({ where: { userId, endpoint } });
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    const vapid = this.vapid;
    if (!vapid) return;
    const devices = await this.prisma.device.findMany({ where: { userId, platform: 'WEB' } });
    await Promise.all(
      devices.map(async (device) => {
        const keys = storedKeysSchema.safeParse(device.keys);
        if (!keys.success) return;
        try {
          await sendNotification(
            { endpoint: device.endpoint, keys: keys.data },
            JSON.stringify(payload),
            { vapidDetails: vapid, TTL: 60 * 60, urgency: 'normal' },
          );
        } catch (error) {
          if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
            await this.prisma.device.deleteMany({ where: { id: device.id } });
            return;
          }
          this.logger.warn({ err: error, deviceId: device.id }, 'Web push gönderilemedi');
        }
      }),
    );
  }
}
