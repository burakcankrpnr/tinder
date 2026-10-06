import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ApiEnv } from '@dating/config';
import { type Notification, Prisma } from '@dating/database';
import type {
  NotificationDto,
  NotificationPageDto,
  NotificationPreferencesDto,
  NotificationType,
} from '@dating/types';
import type {
  MarkNotificationsReadInput,
  NotificationPreferencesInput,
  NotificationsQueryInput,
} from '@dating/validation';
import { ENV } from '../../config/env.module';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { notificationMail } from '../mail/notification-mails';
import { RealtimeService } from '../realtime/realtime.service';
import {
  DEFAULT_PREFERENCES,
  EMAIL_TYPES,
  type NotificationData,
  PREFERENCE_FOR_TYPE,
  renderNotification,
} from './notification-content';
import { PushService } from './push.service';

export interface NotifyOptions {
  /** Okunmamış aynı gruptaki bildirim varsa yeni kayıt yerine sayaç artar. */
  groupKey?: string;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly push: PushService,
    private readonly mail: MailService,
    @Inject(ENV) private readonly env: ApiEnv,
  ) {}

  toDto(notification: Notification): NotificationDto {
    const content = renderNotification(notification.type, notification.data, notification.count);
    return {
      id: notification.id,
      type: notification.type,
      ...content,
      count: notification.count,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
      updatedAt: notification.updatedAt.toISOString(),
    };
  }

  async preferences(userId: string): Promise<NotificationPreferencesDto> {
    const row = await this.prisma.notificationPreferences.findUnique({ where: { userId } });
    if (!row) return { ...DEFAULT_PREFERENCES };
    return {
      newMatch: row.newMatch,
      newMessage: row.newMessage,
      someoneLikedYou: row.someoneLikedYou,
      billing: row.billing,
      email: row.email,
      push: row.push,
    };
  }

  async updatePreferences(
    userId: string,
    input: NotificationPreferencesInput,
  ): Promise<NotificationPreferencesDto> {
    await this.prisma.notificationPreferences.upsert({
      where: { userId },
      create: { userId, ...DEFAULT_PREFERENCES, ...input },
      update: input,
    });
    return this.preferences(userId);
  }

  /**
   * Bildirimi kaydeder ve kanallara (in-app socket, web push, email) dağıtır.
   * Kanal hataları akışı bozmaz; kullanıcı tercihi kapalıysa hiçbir kanal kullanılmaz.
   */
  async notify<T extends NotificationType>(
    userId: string,
    type: T,
    data: NotificationData<T>,
    options: NotifyOptions = {},
  ): Promise<NotificationDto | null> {
    const prefs = await this.preferences(userId);
    if (!prefs[PREFERENCE_FOR_TYPE[type]]) return null;

    const notification = await this.persist(userId, type, data as Prisma.InputJsonObject, options.groupKey);
    const dto = this.toDto(notification);
    this.realtime.toUser(userId, 'notification:new', dto);

    if (prefs.push) {
      void this.push
        .sendToUser(userId, { title: dto.title, body: dto.body, href: dto.href, tag: options.groupKey ?? dto.id })
        .catch((error: unknown) => this.logger.warn({ err: error }, 'Push dağıtımı başarısız'));
    }
    if (prefs.email && EMAIL_TYPES.has(type) && notification.count === 1) {
      void this.sendEmail(userId, dto).catch((error: unknown) =>
        this.logger.warn({ err: error, type }, 'Bildirim emaili gönderilemedi'),
      );
    }
    return dto;
  }

  private async persist(
    userId: string,
    type: NotificationType,
    data: Prisma.InputJsonObject,
    groupKey: string | undefined,
  ): Promise<Notification> {
    if (!groupKey) return this.prisma.notification.create({ data: { userId, type, data } });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const existing = await this.prisma.notification.findFirst({
        where: { userId, groupKey, readAt: null },
        select: { id: true },
      });
      if (existing) {
        const updated = await this.prisma.notification.updateMany({
          where: { id: existing.id, readAt: null },
          data: { count: { increment: 1 }, data, type },
        });
        if (updated.count > 0) return this.prisma.notification.findUniqueOrThrow({ where: { id: existing.id } });
        continue;
      }
      try {
        return await this.prisma.notification.create({ data: { userId, type, data, groupKey } });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    return this.prisma.notification.create({ data: { userId, type, data } });
  }

  private async sendEmail(userId: string, dto: NotificationDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerifiedAt: true, deletedAt: true },
    });
    if (!user?.emailVerifiedAt || user.deletedAt) return;
    const url = new URL(dto.href ?? '/notifications', this.env.NEXT_PUBLIC_APP_URL).toString();
    await this.mail.send(notificationMail(user.email, dto.title, dto.body, url));
  }

  async list(userId: string, query: NotificationsQueryInput): Promise<NotificationPageDto> {
    let cursor: { updatedAt: Date; id: string } | null = null;
    if (query.before) {
      cursor = await this.prisma.notification.findFirst({
        where: { id: query.before, userId },
        select: { updatedAt: true, id: true },
      });
    }
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(cursor
          ? {
              OR: [
                { updatedAt: { lt: cursor.updatedAt } },
                { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const page = rows.slice(0, query.limit);
    return {
      notifications: page.map((row) => this.toDto(row)),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
      unreadCount: await this.unreadCount(userId),
    };
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, input: MarkNotificationsReadInput): Promise<number> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...('ids' in input ? { id: { in: input.ids } } : {}) },
      data: { readAt: new Date() },
    });
    return this.unreadCount(userId);
  }

  async markGroupRead(userId: string, groupKey: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, groupKey, readAt: null },
      data: { readAt: new Date() },
    });
  }

  /** Eşleşme bittiğinde o eşleşmeye ait bildirimler iki taraftan da kaldırılır. */
  async removeGroups(userIds: string[], groupKeys: string[]): Promise<void> {
    await this.prisma.notification.deleteMany({
      where: { userId: { in: userIds }, groupKey: { in: groupKeys } },
    });
  }
}
