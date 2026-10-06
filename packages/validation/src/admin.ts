import { z } from 'zod';

import { REPORT_REASONS } from './communication';

export const USER_STATUSES = ['ACTIVE', 'RESTRICTED', 'BANNED', 'DEACTIVATED'] as const;
export const MODERATABLE_STATUSES = ['ACTIVE', 'RESTRICTED', 'BANNED'] as const;
export const USER_ROLES = ['USER', 'MODERATOR', 'ADMIN'] as const;
export const REPORT_STATUSES = ['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'] as const;
export const MODERATION_ACTIONS = ['NONE', 'RESTRICT', 'BAN'] as const;
export const SUBSCRIPTION_STATES = ['ACTIVE', 'CANCEL_AT_PERIOD_END', 'GRACE_PERIOD', 'EXPIRED'] as const;
export const PAYMENT_STATUSES = ['SUCCEEDED', 'FAILED', 'REFUNDED'] as const;
export const ANALYTICS_PLATFORMS = ['web', 'ios', 'android'] as const;
export const FEATURE_FLAG_KEY_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

/** İstemcinin gönderebileceği olaylar; diğerleri sunucuda domain event'lerinden üretilir. */
export const CLIENT_ANALYTICS_EVENTS = ['APP_OPENED', 'SIGNUP_STARTED', 'PROFILE_VIEWED', 'PAYWALL_VIEWED'] as const;

const cursor = z.uuid().optional();
const limit = z.coerce.number().int().min(1).max(100).default(25);
const reason = z.string().trim().min(3, 'Gerekçe en az 3 karakter olmalı.').max(500);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const flagKeyParamSchema = z.object({ key: z.string().regex(FEATURE_FLAG_KEY_PATTERN) });

export const queueQuerySchema = z.object({ cursor, limit });

export const adminUsersQuerySchema = z.object({
  q: optionalText(100),
  status: z.enum(USER_STATUSES).optional(),
  role: z.enum(USER_ROLES).optional(),
  cursor,
  limit,
});

export const updateUserStatusSchema = z.object({ status: z.enum(MODERATABLE_STATUSES), reason });
export const updateUserRoleSchema = z.object({ role: z.enum(USER_ROLES) });

export const featureOverrideSchema = z.discriminatedUnion('feature', [
  z.object({
    feature: z.literal('dailyLikeLimit'),
    value: z.number().int().min(0).max(100_000).nullable(),
    expiresAt: z.iso.datetime().optional(),
  }),
  z.object({
    feature: z.enum(['rewind', 'seeLikes', 'incognito', 'passport', 'advancedFilters', 'adFree']),
    value: z.boolean(),
    expiresAt: z.iso.datetime().optional(),
  }),
]);
export const overrideFeatureParamSchema = z.object({
  id: z.uuid(),
  feature: z.enum(['dailyLikeLimit', 'rewind', 'seeLikes', 'incognito', 'passport', 'advancedFilters', 'adFree']),
});

export const grantEntitlementSchema = z.object({
  type: z.enum(['SUPER_LIKE', 'BOOST']),
  quantity: z.number().int().min(1).max(100),
  reason,
});

export const adminReportsQuerySchema = z.object({
  status: z.enum(REPORT_STATUSES).optional(),
  reason: z.enum(REPORT_REASONS).optional(),
  userId: z.uuid().optional(),
  cursor,
  limit,
});

export const resolveReportSchema = z.object({
  status: z.enum(['REVIEWING', 'RESOLVED', 'DISMISSED']),
  resolution: optionalText(1000),
  action: z.enum(MODERATION_ACTIONS).default('NONE'),
});

export const moderationDecisionSchema = z
  .object({ decision: z.enum(['APPROVE', 'REJECT']), reason: optionalText(300) })
  .refine((value) => value.decision === 'APPROVE' || Boolean(value.reason), {
    message: 'Reddetme gerekçesi yaz.',
    path: ['reason'],
  });

export const adminSubscriptionsQuerySchema = z.object({
  state: z.enum(SUBSCRIPTION_STATES).optional(),
  plan: z.string().max(40).optional(),
  cursor,
  limit,
});

export const adminPaymentsQuerySchema = z.object({
  status: z.enum(PAYMENT_STATUSES).optional(),
  userId: z.uuid().optional(),
  cursor,
  limit,
});

export const refundSchema = z.object({ reason });
export const adminCancelSubscriptionSchema = z.object({
  /** true: hemen sonlandır; false: dönem sonunda. */
  immediately: z.boolean().default(false),
  reason,
});

const price = z.number().int().min(0).max(100_000_000);
export const updatePlanSchema = z
  .object({
    name: z.string().trim().min(2).max(40),
    description: z.string().trim().max(300).nullable(),
    monthlyPrice: price,
    yearlyPrice: price,
    swipeLimit: z.number().int().min(0).max(100_000).nullable(),
    superLikeLimit: z.number().int().min(0).max(1000),
    boostLimit: z.number().int().min(0).max(100),
    active: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'En az bir alan gönder.');

export const updateFeatureFlagSchema = z
  .object({
    enabled: z.boolean(),
    rolloutPercent: z.number().int().min(0).max(100),
    description: z.string().trim().min(3).max(200),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'En az bir alan gönder.');

export const createFeatureFlagSchema = z.object({
  key: z.string().regex(FEATURE_FLAG_KEY_PATTERN, 'Anahtar BÜYÜK_HARF_VE_ALT_ÇİZGİ olmalı.'),
  description: z.string().trim().min(3).max(200),
  enabled: z.boolean().default(false),
  rolloutPercent: z.number().int().min(0).max(100).default(100),
});

export const auditQuerySchema = z.object({
  action: z.string().max(80).optional(),
  actorId: z.uuid().optional(),
  targetId: z.string().max(80).optional(),
  cursor,
  limit,
});

export const dashboardQuerySchema = z.object({ days: z.coerce.number().int().min(7).max(90).default(30) });

const dateOnly = z.iso.date();
export const analyticsQuerySchema = z
  .object({
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    country: z.string().length(2).toUpperCase().optional(),
    city: z.string().trim().max(80).optional(),
    platform: z.enum(ANALYTICS_PLATFORMS).optional(),
    plan: z.string().max(40).optional(),
    status: z.enum(USER_STATUSES).optional(),
    /** Seçilen aralıktaki pazarlama harcaması (kuruş); CAC için. */
    marketingSpend: z.coerce.number().int().min(0).optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'Başlangıç tarihi bitişten sonra olamaz.',
    path: ['from'],
  });

export const analyticsEventSchema = z.object({
  name: z.enum(CLIENT_ANALYTICS_EVENTS),
  /** İstemcide üretilir; aynı id ile tekrar gönderim tek kayıt oluşturur. */
  clientId: z.uuid(),
  platform: z.enum(ANALYTICS_PLATFORMS).default('web'),
  properties: z
    .record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean()]))
    .refine((value) => Object.keys(value).length <= 20, 'En fazla 20 özellik gönderilebilir.')
    .optional(),
});

export type QueueQuery = z.infer<typeof queueQuerySchema>;
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type FeatureOverrideInput = z.infer<typeof featureOverrideSchema>;
export type GrantEntitlementInput = z.infer<typeof grantEntitlementSchema>;
export type AdminReportsQuery = z.infer<typeof adminReportsQuerySchema>;
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;
export type ResolveReportFormInput = z.input<typeof resolveReportSchema>;
export type ModerationDecisionInput = z.infer<typeof moderationDecisionSchema>;
export type AdminSubscriptionsQuery = z.infer<typeof adminSubscriptionsQuerySchema>;
export type AdminPaymentsQuery = z.infer<typeof adminPaymentsQuerySchema>;
export type RefundInput = z.infer<typeof refundSchema>;
export type AdminCancelSubscriptionInput = z.infer<typeof adminCancelSubscriptionSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type UpdateFeatureFlagInput = z.infer<typeof updateFeatureFlagSchema>;
export type CreateFeatureFlagInput = z.infer<typeof createFeatureFlagSchema>;
export type AuditQuery = z.infer<typeof auditQuerySchema>;
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;
export type ClientAnalyticsEvent = (typeof CLIENT_ANALYTICS_EVENTS)[number];
