import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@dating/database';
import type { AnalyticsEventInput } from '@dating/validation';
import { PrismaService } from '../../infra/prisma/prisma.service';

/** Spec Bölüm 31 olay adları. İstemci yalnızca `CLIENT_ANALYTICS_EVENTS` gönderebilir. */
export const AnalyticsEventName = {
  APP_OPENED: 'APP_OPENED',
  SIGNUP_STARTED: 'SIGNUP_STARTED',
  SIGNUP_COMPLETED: 'SIGNUP_COMPLETED',
  ONBOARDING_COMPLETED: 'ONBOARDING_COMPLETED',
  PROFILE_VIEWED: 'PROFILE_VIEWED',
  SWIPE_LIKED: 'SWIPE_LIKED',
  SWIPE_PASSED: 'SWIPE_PASSED',
  MATCH_CREATED: 'MATCH_CREATED',
  MESSAGE_SENT: 'MESSAGE_SENT',
  PAYWALL_VIEWED: 'PAYWALL_VIEWED',
  CHECKOUT_STARTED: 'CHECKOUT_STARTED',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_REFUNDED: 'PAYMENT_REFUNDED',
  SUBSCRIPTION_STARTED: 'SUBSCRIPTION_STARTED',
  SUBSCRIPTION_CANCELLED: 'SUBSCRIPTION_CANCELLED',
  BOOST_USED: 'BOOST_USED',
  SUPERLIKE_USED: 'SUPERLIKE_USED',
  USER_REPORTED: 'USER_REPORTED',
} as const;

export type AnalyticsEventName = (typeof AnalyticsEventName)[keyof typeof AnalyticsEventName];

type Properties = Record<string, string | number | boolean | null>;

/**
 * Ürün analitiği için olay deposu. Analitik hiçbir zaman kullanıcı akışını bozmamalı:
 * yazma hataları yutulur ve loglanır. Olaylara e-posta, IP gibi kişisel veri eklenmez.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async track(name: AnalyticsEventName, userId: string | null, properties?: Properties): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          name,
          userId,
          ...(properties ? { properties: properties as Prisma.InputJsonObject } : {}),
        },
      });
    } catch (error) {
      this.logger.warn({ err: error, name }, 'Analytics olayı yazılamadı');
    }
  }

  /** İstemci olayı; aynı kullanıcı + `clientId` ikinci kez kaydedilmez. */
  async trackClient(userId: string | null, input: AnalyticsEventInput): Promise<void> {
    try {
      await this.prisma.analyticsEvent.createMany({
        data: [
          {
            name: input.name,
            userId,
            clientId: input.clientId,
            platform: input.platform,
            ...(input.properties ? { properties: input.properties } : {}),
          },
        ],
        skipDuplicates: true,
      });
    } catch (error) {
      this.logger.warn({ err: error, name: input.name }, 'İstemci analytics olayı yazılamadı');
    }
  }
}
