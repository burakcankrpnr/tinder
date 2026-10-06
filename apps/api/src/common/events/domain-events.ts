/** Spec Bölüm 20: ileride Redis Streams/Kafka'ya taşınabilecek domain event'leri. */
export const DomainEvent = {
  USER_REGISTERED: 'USER_REGISTERED',
  PROFILE_COMPLETED: 'PROFILE_COMPLETED',
  SWIPE_CREATED: 'SWIPE_CREATED',
  MATCH_CREATED: 'MATCH_CREATED',
  MATCH_ENDED: 'MATCH_ENDED',
  MESSAGE_SENT: 'MESSAGE_SENT',
  USER_REPORTED: 'USER_REPORTED',
  USER_BLOCKED: 'USER_BLOCKED',
  CHECKOUT_STARTED: 'CHECKOUT_STARTED',
  SUBSCRIPTION_CREATED: 'SUBSCRIPTION_CREATED',
  SUBSCRIPTION_RENEWED: 'SUBSCRIPTION_RENEWED',
  SUBSCRIPTION_CANCELLED: 'SUBSCRIPTION_CANCELLED',
  SUBSCRIPTION_EXPIRING: 'SUBSCRIPTION_EXPIRING',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  PAYMENT_SUCCEEDED: 'PAYMENT_SUCCEEDED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  BOOST_ACTIVATED: 'BOOST_ACTIVATED',
  SUPER_LIKE_USED: 'SUPER_LIKE_USED',
  PAYMENT_REFUNDED: 'PAYMENT_REFUNDED',
  USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',
} as const;

export interface UserStatusChangedEvent {
  userId: string;
  actorUserId: string;
  from: string;
  to: string;
  reason: string;
}

export interface PaymentRefundedEvent {
  paymentId: string;
  userId: string;
  amount: number;
  currency: string;
}

export interface CheckoutStartedEvent {
  userId: string;
  checkoutSessionId: string;
  kind: 'SUBSCRIPTION' | 'PRODUCT';
  target: string;
  amount: number;
}

export interface SubscriptionEvent {
  subscriptionId: string;
  userId: string;
  planSlug: string;
  planName: string;
  currentPeriodEnd: string;
}

export interface PaymentEventPayload {
  paymentId: string;
  userId: string;
  amount: number;
  currency: string;
  subscriptionId: string | null;
  planName: string | null;
  reason?: string;
}

export interface BoostActivatedEvent {
  userId: string;
  endsAt: string;
}

export interface SuperLikeUsedEvent {
  userId: string;
  targetUserId: string;
}

export interface UserRegisteredEvent {
  userId: string;
  method: 'password' | 'google';
}

export interface ProfileCompletedEvent {
  userId: string;
  completedAt: string;
}

export interface SwipeCreatedEvent {
  swipeId: string;
  actorUserId: string;
  targetUserId: string;
  action: 'LIKE' | 'PASS' | 'SUPER_LIKE';
}

export interface MatchCreatedEvent {
  matchId: string;
  userIds: [string, string];
  createdAt: string;
}

export interface MatchEndedEvent {
  matchId: string;
  userIds: [string, string];
  endedById: string;
  reason: 'UNMATCHED' | 'BLOCKED';
}

export interface MessageSentEvent {
  messageId: string;
  matchId: string;
  senderId: string;
  recipientId: string;
  type: 'TEXT' | 'IMAGE';
}

export interface UserReportedEvent {
  reportId: string;
  reporterId: string;
  reportedUserId: string;
  reason: string;
}

export interface UserBlockedEvent {
  blockerId: string;
  blockedId: string;
}
