import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  type BoostActivatedEvent,
  type CheckoutStartedEvent,
  DomainEvent,
  type MatchCreatedEvent,
  type MessageSentEvent,
  type PaymentEventPayload,
  type PaymentRefundedEvent,
  type ProfileCompletedEvent,
  type SubscriptionEvent,
  type SuperLikeUsedEvent,
  type SwipeCreatedEvent,
  type UserRegisteredEvent,
  type UserReportedEvent,
} from '../../common/events/domain-events';
import { AnalyticsEventName, AnalyticsService } from './analytics.service';

const ASYNC = { async: true, promisify: true } as const;

/** Spec Bölüm 20 "AnalyticsService" event consumer'ı: domain event'lerini analitik olaylara çevirir. */
@Injectable()
export class AnalyticsListener {
  constructor(private readonly analytics: AnalyticsService) {}

  @OnEvent(DomainEvent.USER_REGISTERED, ASYNC)
  onRegistered(event: UserRegisteredEvent): Promise<void> {
    return this.analytics.track(AnalyticsEventName.SIGNUP_COMPLETED, event.userId, { method: event.method });
  }

  @OnEvent(DomainEvent.PROFILE_COMPLETED, ASYNC)
  onProfileCompleted(event: ProfileCompletedEvent): Promise<void> {
    return this.analytics.track(AnalyticsEventName.ONBOARDING_COMPLETED, event.userId);
  }

  @OnEvent(DomainEvent.SWIPE_CREATED, ASYNC)
  onSwipe(event: SwipeCreatedEvent): Promise<void> {
    if (event.action === 'PASS') return this.analytics.track(AnalyticsEventName.SWIPE_PASSED, event.actorUserId);
    return this.analytics.track(AnalyticsEventName.SWIPE_LIKED, event.actorUserId, {
      superLike: event.action === 'SUPER_LIKE',
    });
  }

  @OnEvent(DomainEvent.SUPER_LIKE_USED, ASYNC)
  onSuperLike(event: SuperLikeUsedEvent): Promise<void> {
    return this.analytics.track(AnalyticsEventName.SUPERLIKE_USED, event.userId);
  }

  @OnEvent(DomainEvent.MATCH_CREATED, ASYNC)
  async onMatch(event: MatchCreatedEvent): Promise<void> {
    await Promise.all(
      event.userIds.map((userId) =>
        this.analytics.track(AnalyticsEventName.MATCH_CREATED, userId, { matchId: event.matchId }),
      ),
    );
  }

  @OnEvent(DomainEvent.MESSAGE_SENT, ASYNC)
  onMessage(event: MessageSentEvent): Promise<void> {
    return this.analytics.track(AnalyticsEventName.MESSAGE_SENT, event.senderId, {
      matchId: event.matchId,
      type: event.type,
    });
  }

  @OnEvent(DomainEvent.CHECKOUT_STARTED, ASYNC)
  onCheckout(event: CheckoutStartedEvent): Promise<void> {
    return this.analytics.track(AnalyticsEventName.CHECKOUT_STARTED, event.userId, {
      kind: event.kind,
      target: event.target,
      amount: event.amount,
    });
  }

  @OnEvent(DomainEvent.PAYMENT_SUCCEEDED, ASYNC)
  onPayment(event: PaymentEventPayload): Promise<void> {
    return this.analytics.track(AnalyticsEventName.PAYMENT_SUCCESS, event.userId, {
      amount: event.amount,
      currency: event.currency,
      subscription: event.subscriptionId !== null,
    });
  }

  @OnEvent(DomainEvent.PAYMENT_REFUNDED, ASYNC)
  onRefund(event: PaymentRefundedEvent): Promise<void> {
    return this.analytics.track(AnalyticsEventName.PAYMENT_REFUNDED, event.userId, {
      amount: event.amount,
      currency: event.currency,
    });
  }

  @OnEvent(DomainEvent.SUBSCRIPTION_CREATED, ASYNC)
  onSubscriptionCreated(event: SubscriptionEvent): Promise<void> {
    return this.analytics.track(AnalyticsEventName.SUBSCRIPTION_STARTED, event.userId, { plan: event.planSlug });
  }

  @OnEvent(DomainEvent.SUBSCRIPTION_CANCELLED, ASYNC)
  onSubscriptionCancelled(event: SubscriptionEvent): Promise<void> {
    return this.analytics.track(AnalyticsEventName.SUBSCRIPTION_CANCELLED, event.userId, { plan: event.planSlug });
  }

  @OnEvent(DomainEvent.BOOST_ACTIVATED, ASYNC)
  onBoost(event: BoostActivatedEvent): Promise<void> {
    return this.analytics.track(AnalyticsEventName.BOOST_USED, event.userId);
  }

  @OnEvent(DomainEvent.USER_REPORTED, ASYNC)
  onReport(event: UserReportedEvent): Promise<void> {
    return this.analytics.track(AnalyticsEventName.USER_REPORTED, event.reporterId, { reason: event.reason });
  }
}
