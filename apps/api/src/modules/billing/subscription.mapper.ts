import type { Subscription, SubscriptionPlan } from '@dating/database';
import type { SubscriptionDto, SubscriptionState } from '@dating/types';

export type SubscriptionWithPlan = Subscription & { plan: SubscriptionPlan };

/** Kullanıcı başına tek kayıt olabilen durumlar (partial unique index ile aynı küme). */
export const LIVE_STATUSES = ['ACTIVE', 'PAST_DUE'] as const;

export function subscriptionState(subscription: Subscription): SubscriptionState {
  if (subscription.status === 'EXPIRED') return 'EXPIRED';
  if (subscription.status === 'PAST_DUE') return 'GRACE_PERIOD';
  return subscription.cancelAtPeriodEnd ? 'CANCEL_AT_PERIOD_END' : 'ACTIVE';
}

export function toSubscriptionDto(subscription: SubscriptionWithPlan): SubscriptionDto {
  return {
    id: subscription.id,
    plan: { slug: subscription.plan.slug, name: subscription.plan.name },
    interval: subscription.interval,
    state: subscriptionState(subscription),
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    graceUntil: subscription.graceUntil?.toISOString() ?? null,
  };
}
