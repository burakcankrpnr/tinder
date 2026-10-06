import { z } from 'zod';

import { photoUploadRequestSchema } from './photos';

export const MAX_MESSAGE_LENGTH = 2000;
export const MESSAGE_PAGE_SIZE = 30;
export const MAX_REPORT_DETAILS = 1000;

export const REPORT_REASONS = [
  'FAKE_PROFILE',
  'HARASSMENT',
  'SCAM',
  'SPAM',
  'SEXUAL_CONTENT',
  'VIOLENCE',
  'UNDERAGE',
  'OTHER',
] as const;

export const NOTIFICATION_TYPES = [
  'NEW_MATCH',
  'NEW_MESSAGE',
  'SOMEONE_LIKED_YOU',
  'SUBSCRIPTION_RENEWED',
  'SUBSCRIPTION_EXPIRING',
  'PAYMENT_FAILED',
] as const;

const messageBody = z
  .string()
  .trim()
  .min(1, 'Mesaj boş olamaz.')
  .max(MAX_MESSAGE_LENGTH, `Mesaj en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir.`);

/** `clientMessageId` istemcide üretilir; aynı id ile tekrar gönderim idempotenttir. */
export const sendMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('TEXT'), clientMessageId: z.uuid(), body: messageBody }),
  z.object({
    type: z.literal('IMAGE'),
    clientMessageId: z.uuid(),
    attachmentKey: z.string().min(1).max(300),
  }),
]);

export const chatAttachmentRequestSchema = photoUploadRequestSchema;

export const messagesQuerySchema = z.object({
  /** Bu mesajdan daha eski mesajları getir (cursor pagination). */
  before: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(MESSAGE_PAGE_SIZE),
});

export const markReadSchema = z.object({
  /** Verilmezse konuşmadaki tüm gelen mesajlar okunur. */
  upToMessageId: z.uuid().optional(),
});

export const matchIdParamSchema = z.object({ matchId: z.uuid() });
export const userIdParamSchema = z.object({ userId: z.uuid() });

export const typingEventSchema = z.object({
  matchId: z.uuid(),
  isTyping: z.boolean(),
});

export const blockSchema = z.object({ userId: z.uuid() });

export const reportSchema = z.object({
  reportedUserId: z.uuid(),
  reason: z.enum(REPORT_REASONS, { message: 'Bir şikayet nedeni seç.' }),
  details: z
    .string()
    .trim()
    .max(MAX_REPORT_DETAILS, `Açıklama en fazla ${MAX_REPORT_DETAILS} karakter olabilir.`)
    .optional()
    .transform((value) => (value ? value : undefined)),
  messageId: z.uuid().optional(),
  /** Şikayetle birlikte kullanıcıyı engelle. */
  block: z.boolean().default(false),
});

export const notificationsQuerySchema = z.object({
  before: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const markNotificationsReadSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.uuid()).min(1).max(100) }),
]);

export const notificationPreferencesSchema = z
  .object({
    newMatch: z.boolean(),
    newMessage: z.boolean(),
    someoneLikedYou: z.boolean(),
    billing: z.boolean(),
    email: z.boolean(),
    push: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'En az bir ayar gönder.');

export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export const pushUnsubscribeSchema = z.object({ endpoint: z.url().max(1000) });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type MessagesQueryInput = z.infer<typeof messagesQuerySchema>;
export type MarkReadInput = z.infer<typeof markReadSchema>;
export type TypingEventInput = z.infer<typeof typingEventSchema>;
export type BlockInput = z.infer<typeof blockSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
export type ReportFormInput = z.input<typeof reportSchema>;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type NotificationsQueryInput = z.infer<typeof notificationsQuerySchema>;
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
