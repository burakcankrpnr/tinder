import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type Message, Prisma } from '@dating/database';
import type { ChatAttachmentUploadDto, ChatMessageDto, MessagePageDto } from '@dating/types';
import {
  MAX_PHOTO_BYTES,
  type MarkReadInput,
  type MessagesQueryInput,
  PHOTO_CONTENT_TYPES,
  type PhotoUploadRequestInput,
  type SendMessageInput,
} from '@dating/validation';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { DomainEvent, type MessageSentEvent } from '../../common/events/domain-events';
import { AppException } from '../../common/http/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { REDIS } from '../../infra/redis/redis.module';
import { ActivityService } from '../activity/activity.service';
import { MatchesService, type MemberMatch } from '../matches/matches.service';
import { messageGroupKey } from '../notifications/notifications.listener';
import { NotificationsService } from '../notifications/notifications.service';
import { InvalidImageError, processChatImage } from '../photos/image-pipeline';
import { RealtimeService } from '../realtime/realtime.service';
import { StorageService } from '../storage/storage.service';

/** Kullanıcı başına dakikalık mesaj limiti (REST ve WebSocket ortak). */
export const MESSAGES_PER_MINUTE = 30;

const attachmentMetaSchema = z.object({ width: z.number(), height: z.number() });
const ALLOWED_TYPES = new Set<string>(PHOTO_CONTENT_TYPES);

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matches: MatchesService,
    private readonly storage: StorageService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
    private readonly activity: ActivityService,
    private readonly events: EventEmitter2,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async toDto(message: Message, matchId: string): Promise<ChatMessageDto> {
    let image: ChatMessageDto['image'] = null;
    if (message.type === 'IMAGE' && message.attachmentKey && !message.deletedAt) {
      const meta = attachmentMetaSchema.safeParse(message.attachmentMeta);
      image = {
        url: await this.storage.signedUploadUrl(message.attachmentKey),
        width: meta.success ? meta.data.width : null,
        height: meta.success ? meta.data.height : null,
      };
    }
    return {
      id: message.id,
      clientMessageId: message.clientMessageId,
      matchId,
      senderId: message.senderId,
      type: message.type,
      body: message.deletedAt ? null : message.body,
      image,
      createdAt: message.createdAt.toISOString(),
      readAt: message.readAt?.toISOString() ?? null,
      deleted: message.deletedAt !== null,
    };
  }

  private async assertCanSend(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (user?.status !== 'ACTIVE') {
      throw AppException.forbidden('Hesabın inceleme altında olduğu için şu an mesaj gönderemezsin.');
    }
  }

  private async consumeRateLimit(userId: string): Promise<void> {
    const key = `rate:chat:${userId}:${Math.floor(Date.now() / 60_000)}`;
    const [[, count]] = (await this.redis.multi().incr(key).expire(key, 70).exec()) as [[null, number]];
    if (count > MESSAGES_PER_MINUTE) {
      throw new AppException('RATE_LIMITED', 'Çok hızlı mesaj gönderiyorsun, biraz yavaşla.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  /**
   * Idempotent: aynı `clientMessageId` ile tekrar gönderim mevcut mesajı döndürür ve
   * olayları yeniden yayınlamaz (bağlantı koptuğunda istemci güvenle tekrar deneyebilir).
   */
  async send(userId: string, matchId: string, input: SendMessageInput): Promise<ChatMessageDto> {
    const member = await this.matches.findActiveForMember(matchId, userId);
    const existing = await this.findByClientId(userId, input.clientMessageId, matchId);
    if (existing) return existing;

    await this.assertCanSend(userId);
    await this.consumeRateLimit(userId);

    const content =
      input.type === 'TEXT'
        ? { body: input.body, attachmentKey: null, attachmentMeta: Prisma.DbNull }
        : await this.prepareImage(userId, member, input.attachmentKey);

    let message: Message;
    try {
      message = await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const conversation = await tx.conversation.upsert({
          where: { matchId },
          create: { matchId, lastMessageAt: now },
          update: { lastMessageAt: now },
        });
        const created = await tx.message.create({
          data: {
            conversationId: conversation.id,
            senderId: userId,
            clientMessageId: input.clientMessageId,
            type: input.type,
            body: content.body,
            attachmentKey: content.attachmentKey,
            attachmentMeta: content.attachmentMeta,
            createdAt: now,
          },
        });
        await tx.match.update({ where: { id: matchId }, data: { lastMessageAt: now } });
        return created;
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const raced = await this.findByClientId(userId, input.clientMessageId, matchId);
      if (raced) return raced;
      throw error;
    }

    const dto = await this.toDto(message, matchId);
    this.realtime.toUsers([userId, member.otherUserId], 'message:new', dto);
    const event: MessageSentEvent = {
      messageId: message.id,
      matchId,
      senderId: userId,
      recipientId: member.otherUserId,
      type: message.type,
    };
    this.events.emit(DomainEvent.MESSAGE_SENT, event);
    void this.activity.touch(userId);
    return dto;
  }

  private async findByClientId(
    senderId: string,
    clientMessageId: string,
    matchId: string,
  ): Promise<ChatMessageDto | null> {
    const message = await this.prisma.message.findUnique({
      where: { senderId_clientMessageId: { senderId, clientMessageId } },
      include: { conversation: { select: { matchId: true } } },
    });
    if (!message) return null;
    if (message.conversation.matchId !== matchId) {
      throw new AppException('CONFLICT', 'Bu mesaj kimliği başka bir konuşmada kullanılmış.', HttpStatus.CONFLICT);
    }
    return this.toDto(message, matchId);
  }

  private attachmentPrefix(matchId: string, userId: string): string {
    return `chat/${matchId}/${userId}/`;
  }

  async createAttachmentUpload(
    userId: string,
    matchId: string,
    input: PhotoUploadRequestInput,
  ): Promise<ChatAttachmentUploadDto> {
    await this.matches.findActiveForMember(matchId, userId);
    await this.assertCanSend(userId);
    const attachmentKey = `${this.attachmentPrefix(matchId, userId)}${randomUUID()}`;
    const upload = await this.storage.createUploadPost(attachmentKey, input.contentType, MAX_PHOTO_BYTES);
    return { attachmentKey, upload };
  }

  /** Ham yükleme doğrulanır, EXIF temizlenip WebP'ye çevrilir; ham dosya silinir. */
  private async prepareImage(
    userId: string,
    member: MemberMatch,
    attachmentKey: string,
  ): Promise<{ body: null; attachmentKey: string; attachmentMeta: Prisma.InputJsonObject }> {
    if (!attachmentKey.startsWith(this.attachmentPrefix(member.match.id, userId))) {
      throw new AppException('BAD_REQUEST', 'Geçersiz ek.', HttpStatus.BAD_REQUEST);
    }
    const head = await this.storage.headUpload(attachmentKey);
    if (!head) throw new AppException('BAD_REQUEST', 'Görsel yüklemesi bulunamadı.', HttpStatus.BAD_REQUEST);
    if (head.size > MAX_PHOTO_BYTES || !head.contentType || !ALLOWED_TYPES.has(head.contentType)) {
      await this.storage.deleteUploads([attachmentKey]);
      throw new AppException('VALIDATION_ERROR', 'Görsel geçersiz.', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    let processed;
    try {
      processed = await processChatImage(await this.storage.getUpload(attachmentKey));
    } catch (error) {
      await this.storage.deleteUploads([attachmentKey]);
      if (error instanceof InvalidImageError) {
        throw new AppException('VALIDATION_ERROR', error.message, HttpStatus.UNPROCESSABLE_ENTITY);
      }
      throw error;
    }
    const finalKey = `chat-media/${member.match.id}/${randomUUID()}.webp`;
    await this.storage.putPrivate(finalKey, processed.buffer, 'image/webp');
    await this.storage.deleteUploads([attachmentKey]);
    return {
      body: null,
      attachmentKey: finalKey,
      attachmentMeta: { width: processed.width, height: processed.height },
    };
  }

  async list(userId: string, matchId: string, query: MessagesQueryInput): Promise<MessagePageDto> {
    await this.matches.findActiveForMember(matchId, userId);
    const conversation = await this.prisma.conversation.findUnique({ where: { matchId }, select: { id: true } });
    if (!conversation) return { messages: [], nextCursor: null };

    let cursor: { createdAt: Date; id: string } | null = null;
    if (query.before) {
      cursor = await this.prisma.message.findFirst({
        where: { id: query.before, conversationId: conversation.id },
        select: { createdAt: true, id: true },
      });
    }
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const page = rows.slice(0, query.limit);
    const messages = await Promise.all(page.reverse().map((message) => this.toDto(message, matchId)));
    return {
      messages,
      nextCursor: rows.length > query.limit ? (messages[0]?.id ?? null) : null,
    };
  }

  /** Read receipt: karşı taraftan gelen (opsiyonel olarak belirli mesaja kadar) okunmamış mesajlar okunur. */
  async markRead(userId: string, matchId: string, input: MarkReadInput): Promise<{ updated: number }> {
    const member = await this.matches.findActiveForMember(matchId, userId);
    const conversation = await this.prisma.conversation.findUnique({ where: { matchId }, select: { id: true } });
    if (!conversation) return { updated: 0 };

    let upTo: Date | undefined;
    if (input.upToMessageId) {
      const target = await this.prisma.message.findFirst({
        where: { id: input.upToMessageId, conversationId: conversation.id },
        select: { createdAt: true },
      });
      if (!target) throw AppException.notFound('Mesaj bulunamadı.');
      upTo = target.createdAt;
    }

    const where: Prisma.MessageWhereInput = {
      conversationId: conversation.id,
      senderId: member.otherUserId,
      readAt: null,
      ...(upTo ? { createdAt: { lte: upTo } } : {}),
    };
    const latest = await this.prisma.message.findFirst({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    if (!latest) return { updated: 0 };

    const readAt = new Date();
    const updated = await this.prisma.message.updateMany({ where, data: { readAt } });
    await this.notifications.markGroupRead(userId, messageGroupKey(matchId));
    if (updated.count > 0) {
      this.realtime.toUsers([member.otherUserId, userId], 'message:read', {
        matchId,
        readerId: userId,
        readAt: readAt.toISOString(),
        upToMessageId: latest.id,
      });
    }
    return { updated: updated.count };
  }

  async delete(userId: string, messageId: string): Promise<void> {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, senderId: userId },
      include: { conversation: { select: { matchId: true } } },
    });
    if (!message) throw AppException.notFound('Mesaj bulunamadı.');
    const { matchId } = message.conversation;
    const member = await this.matches.findActiveForMember(matchId, userId);

    const updated = await this.prisma.message.updateMany({
      where: { id: messageId, deletedAt: null },
      data: { deletedAt: new Date(), body: null, attachmentKey: null, attachmentMeta: Prisma.DbNull },
    });
    if (updated.count === 0) return;

    if (message.attachmentKey) {
      await this.storage
        .deleteUploads([message.attachmentKey])
        .catch((error: unknown) => this.logger.warn({ err: error, messageId }, 'Sohbet görseli silinemedi'));
    }
    this.realtime.toUsers([userId, member.otherUserId], 'message:deleted', { matchId, messageId });
  }
}
