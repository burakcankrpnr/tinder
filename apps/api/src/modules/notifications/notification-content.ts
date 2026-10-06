import type { NotificationPreferencesDto, NotificationType } from '@dating/types';
import { z } from 'zod';

export const notificationDataSchemas = {
  NEW_MATCH: z.object({ matchId: z.uuid(), firstName: z.string() }),
  NEW_MESSAGE: z.object({ matchId: z.uuid(), firstName: z.string() }),
  SOMEONE_LIKED_YOU: z.object({}),
  SUBSCRIPTION_RENEWED: z.object({ planName: z.string() }),
  SUBSCRIPTION_EXPIRING: z.object({ planName: z.string(), expiresAt: z.string() }),
  PAYMENT_FAILED: z.object({ planName: z.string() }),
} satisfies Record<NotificationType, z.ZodType>;

export type NotificationData<T extends NotificationType> = z.infer<(typeof notificationDataSchemas)[T]>;

export interface NotificationContent {
  title: string;
  body: string;
  href: string | null;
}

export const PREFERENCE_FOR_TYPE: Record<
  NotificationType,
  keyof Pick<NotificationPreferencesDto, 'newMatch' | 'newMessage' | 'someoneLikedYou' | 'billing'>
> = {
  NEW_MATCH: 'newMatch',
  NEW_MESSAGE: 'newMessage',
  SOMEONE_LIKED_YOU: 'someoneLikedYou',
  SUBSCRIPTION_RENEWED: 'billing',
  SUBSCRIPTION_EXPIRING: 'billing',
  PAYMENT_FAILED: 'billing',
};

/** Email ile de gönderilen türler; mesaj/like gibi sık olanlar yalnızca in-app + push. */
export const EMAIL_TYPES: ReadonlySet<NotificationType> = new Set([
  'NEW_MATCH',
  'SUBSCRIPTION_EXPIRING',
  'PAYMENT_FAILED',
]);

export const DEFAULT_PREFERENCES: NotificationPreferencesDto = {
  newMatch: true,
  newMessage: true,
  someoneLikedYou: true,
  billing: true,
  email: true,
  push: true,
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long' }).format(new Date(iso));
}

/** Saklanan veri bozuksa genel bir metne düşer; bildirim listesi asla patlamaz. */
export function renderNotification(type: NotificationType, data: unknown, count: number): NotificationContent {
  switch (type) {
    case 'NEW_MATCH': {
      const parsed = notificationDataSchemas.NEW_MATCH.safeParse(data);
      if (!parsed.success) return { title: 'Yeni eşleşme!', body: 'Yeni bir eşleşmen var.', href: '/matches' };
      return {
        title: 'Yeni eşleşme!',
        body: `${parsed.data.firstName} ile eşleştin. İlk mesajı sen gönder.`,
        href: `/matches/${parsed.data.matchId}`,
      };
    }
    case 'NEW_MESSAGE': {
      const parsed = notificationDataSchemas.NEW_MESSAGE.safeParse(data);
      if (!parsed.success) return { title: 'Yeni mesaj', body: 'Yeni mesajın var.', href: '/matches' };
      return {
        title: `${parsed.data.firstName} sana yazdı`,
        body: count > 1 ? `${count} yeni mesaj` : 'Yeni bir mesajın var.',
        href: `/matches/${parsed.data.matchId}`,
      };
    }
    case 'SOMEONE_LIKED_YOU':
      return {
        title: 'Biri seni beğendi',
        body: count > 1 ? `${count} kişi seni beğendi.` : 'Keşfetmeye devam et, belki eşleşirsiniz.',
        href: '/likes',
      };
    case 'SUBSCRIPTION_RENEWED': {
      const parsed = notificationDataSchemas.SUBSCRIPTION_RENEWED.safeParse(data);
      return {
        title: 'Aboneliğin yenilendi',
        body: parsed.success ? `${parsed.data.planName} aboneliğin yenilendi.` : 'Aboneliğin yenilendi.',
        href: '/subscription',
      };
    }
    case 'SUBSCRIPTION_EXPIRING': {
      const parsed = notificationDataSchemas.SUBSCRIPTION_EXPIRING.safeParse(data);
      return {
        title: 'Aboneliğin sona eriyor',
        body: parsed.success
          ? `${parsed.data.planName} aboneliğin ${formatDate(parsed.data.expiresAt)} tarihinde sona erecek.`
          : 'Aboneliğin yakında sona erecek.',
        href: '/subscription',
      };
    }
    case 'PAYMENT_FAILED': {
      const parsed = notificationDataSchemas.PAYMENT_FAILED.safeParse(data);
      return {
        title: 'Ödeme alınamadı',
        body: parsed.success
          ? `${parsed.data.planName} ödemesi başarısız oldu. Ödeme yöntemini kontrol et.`
          : 'Ödemen başarısız oldu. Ödeme yöntemini kontrol et.',
        href: '/subscription',
      };
    }
  }
}
