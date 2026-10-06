import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DomainEvent,
  type MatchCreatedEvent,
  type MatchEndedEvent,
  type MessageSentEvent,
  type PaymentEventPayload,
  type SubscriptionEvent,
  type SwipeCreatedEvent,
} from '../../common/events/domain-events';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { orderedPair } from '../matches/match.mapper';
import { NotificationsService } from './notifications.service';

export const matchGroupKey = (matchId: string): string => `match:${matchId}`;
export const messageGroupKey = (matchId: string): string => `message:${matchId}`;
export const LIKES_GROUP_KEY = 'likes';

/** Spec Bölüm 9 & 20: MATCH_CREATED / MESSAGE_SENT / SWIPE_CREATED → NotificationService. */
@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async firstName(userId: string): Promise<string> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { firstName: true },
    });
    return profile?.firstName ?? 'Biri';
  }

  @OnEvent(DomainEvent.MATCH_CREATED, { async: true, promisify: true })
  async onMatchCreated(event: MatchCreatedEvent): Promise<void> {
    const [first, second] = event.userIds;
    try {
      const [firstName, secondName] = await Promise.all([this.firstName(first), this.firstName(second)]);
      await Promise.all([
        this.notifications.notify(
          first,
          'NEW_MATCH',
          { matchId: event.matchId, firstName: secondName },
          { groupKey: matchGroupKey(event.matchId) },
        ),
        this.notifications.notify(
          second,
          'NEW_MATCH',
          { matchId: event.matchId, firstName },
          { groupKey: matchGroupKey(event.matchId) },
        ),
      ]);
    } catch (error) {
      this.logger.error({ err: error, matchId: event.matchId }, 'NEW_MATCH bildirimi oluşturulamadı');
    }
  }

  @OnEvent(DomainEvent.MESSAGE_SENT, { async: true, promisify: true })
  async onMessageSent(event: MessageSentEvent): Promise<void> {
    try {
      await this.notifications.notify(
        event.recipientId,
        'NEW_MESSAGE',
        { matchId: event.matchId, firstName: await this.firstName(event.senderId) },
        { groupKey: messageGroupKey(event.matchId) },
      );
    } catch (error) {
      this.logger.error({ err: error, messageId: event.messageId }, 'NEW_MESSAGE bildirimi oluşturulamadı');
    }
  }

  /** Beğeni match ile sonuçlandıysa NEW_MATCH yeterli; ayrıca "biri seni beğendi" gönderilmez. */
  @OnEvent(DomainEvent.SWIPE_CREATED, { async: true, promisify: true })
  async onSwipeCreated(event: SwipeCreatedEvent): Promise<void> {
    if (event.action === 'PASS') return;
    try {
      const match = await this.prisma.match.findUnique({
        where: { userAId_userBId: orderedPair(event.actorUserId, event.targetUserId) },
        select: { id: true },
      });
      if (match) return;
      await this.notifications.notify(event.targetUserId, 'SOMEONE_LIKED_YOU', {}, { groupKey: LIKES_GROUP_KEY });
    } catch (error) {
      this.logger.error({ err: error, swipeId: event.swipeId }, 'SOMEONE_LIKED_YOU bildirimi oluşturulamadı');
    }
  }

  @OnEvent(DomainEvent.SUBSCRIPTION_RENEWED, { async: true, promisify: true })
  async onSubscriptionRenewed(event: SubscriptionEvent): Promise<void> {
    try {
      await this.notifications.notify(event.userId, 'SUBSCRIPTION_RENEWED', { planName: event.planName });
    } catch (error) {
      this.logger.error({ err: error, subscriptionId: event.subscriptionId }, 'Yenileme bildirimi oluşturulamadı');
    }
  }

  @OnEvent(DomainEvent.SUBSCRIPTION_EXPIRING, { async: true, promisify: true })
  async onSubscriptionExpiring(event: SubscriptionEvent): Promise<void> {
    try {
      await this.notifications.notify(event.userId, 'SUBSCRIPTION_EXPIRING', {
        planName: event.planName,
        expiresAt: event.currentPeriodEnd,
      });
    } catch (error) {
      this.logger.error({ err: error, subscriptionId: event.subscriptionId }, 'Bitiş bildirimi oluşturulamadı');
    }
  }

  /** Yalnızca abonelik yenileme hataları; checkout hatasını kullanıcı ödeme ekranında zaten görür. */
  @OnEvent(DomainEvent.PAYMENT_FAILED, { async: true, promisify: true })
  async onPaymentFailed(event: PaymentEventPayload): Promise<void> {
    if (!event.subscriptionId || !event.planName) return;
    try {
      await this.notifications.notify(event.userId, 'PAYMENT_FAILED', { planName: event.planName });
    } catch (error) {
      this.logger.error({ err: error, paymentId: event.paymentId }, 'Ödeme hatası bildirimi oluşturulamadı');
    }
  }

  @OnEvent(DomainEvent.MATCH_ENDED, { async: true, promisify: true })
  async onMatchEnded(event: MatchEndedEvent): Promise<void> {
    try {
      await this.notifications.removeGroups(event.userIds, [
        matchGroupKey(event.matchId),
        messageGroupKey(event.matchId),
      ]);
    } catch (error) {
      this.logger.error({ err: error, matchId: event.matchId }, 'Eşleşme bildirimleri temizlenemedi');
    }
  }
}
