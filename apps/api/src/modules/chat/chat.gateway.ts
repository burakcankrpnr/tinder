import { HttpException, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type {
  ApiResponse,
  ChatMessageDto,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@dating/types';
import { sendMessageSchema, typingEventSchema } from '@dating/validation';
import type { Socket } from 'socket.io';
import { z } from 'zod';
import { AppException } from '../../common/http/app.exception';
import { TokenService } from '../auth/token.service';
import { MatchesService } from '../matches/matches.service';
import { PRESENCE_HEARTBEAT_MS, PresenceService } from '../realtime/presence.service';
import { type RealtimeNamespace, RealtimeService, userRoom } from '../realtime/realtime.service';
import { ChatService } from './chat.service';

interface SocketData {
  userId: string;
  expiresAt: number;
  heartbeat?: NodeJS.Timeout;
  lastTypingAt?: number;
  /** Üyeliği doğrulanmış match → karşı taraf (typing için her olayda DB'ye gitmemek adına kısa süreli). */
  partners?: Map<string, { otherUserId: string; checkedAt: number }>;
}

type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const TYPING_MIN_INTERVAL_MS = 1_000;
const PARTNER_CACHE_MS = 60_000;
const sendPayloadSchema = z.object({ matchId: z.uuid(), message: sendMessageSchema });

function failure(error: unknown): ApiResponse<never> {
  if (error instanceof AppException) {
    return { success: false, error: { code: error.code, message: error.message, details: error.details } };
  }
  if (error instanceof HttpException) {
    return { success: false, error: { code: 'BAD_REQUEST', message: error.message } };
  }
  return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Beklenmeyen bir hata oluştu.' } };
}

@WebSocketGateway({ namespace: '/realtime' })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly tokens: TokenService,
    private readonly chat: ChatService,
    private readonly matches: MatchesService,
    private readonly presence: PresenceService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(namespace: RealtimeNamespace): void {
    this.realtime.attach(namespace);
    namespace.use((socket, next) => {
      const token: unknown = socket.handshake.auth.token;
      if (typeof token !== 'string' || token.length === 0) {
        next(new Error('UNAUTHORIZED'));
        return;
      }
      this.tokens
        .verifyAccessTokenClaims(token)
        .then(({ user, expiresAt }) => {
          const data = socket.data as SocketData;
          data.userId = user.id;
          data.expiresAt = expiresAt;
          next();
        })
        .catch(() => next(new Error('UNAUTHORIZED')));
    });
  }

  async handleConnection(socket: ChatSocket): Promise<void> {
    const { userId } = socket.data;
    if (!userId) {
      socket.disconnect(true);
      return;
    }
    await socket.join(userRoom(userId));
    socket.data.partners = new Map();
    socket.data.heartbeat = setInterval(() => {
      if (Date.now() >= socket.data.expiresAt) {
        socket.disconnect(true);
        return;
      }
      void this.presence.heartbeat(userId, socket.id).catch(() => undefined);
    }, PRESENCE_HEARTBEAT_MS);

    try {
      if (await this.presence.connect(userId, socket.id)) await this.broadcastPresence(userId, true);
    } catch (error) {
      this.logger.warn({ err: error }, 'Presence güncellenemedi');
    }
  }

  async handleDisconnect(socket: ChatSocket): Promise<void> {
    const { userId, heartbeat } = socket.data;
    if (heartbeat) clearInterval(heartbeat);
    if (!userId) return;
    try {
      if (await this.presence.disconnect(userId, socket.id)) await this.broadcastPresence(userId, false);
    } catch (error) {
      this.logger.warn({ err: error }, 'Presence güncellenemedi');
    }
  }

  /** Online durumu yalnızca aktif eşleşmelere yayınlanır. */
  private async broadcastPresence(userId: string, online: boolean): Promise<void> {
    const partners = await this.matches.activePartnerIds(userId);
    this.realtime.toUsers(partners, 'presence', { userId, online });
  }

  private async partnerFor(socket: ChatSocket, matchId: string): Promise<string> {
    const cached = socket.data.partners?.get(matchId);
    if (cached && Date.now() - cached.checkedAt < PARTNER_CACHE_MS) return cached.otherUserId;
    const { otherUserId } = await this.matches.findActiveForMember(matchId, socket.data.userId);
    socket.data.partners?.set(matchId, { otherUserId, checkedAt: Date.now() });
    return otherUserId;
  }

  @SubscribeMessage('typing')
  async onTyping(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown): Promise<void> {
    const parsed = typingEventSchema.safeParse(body);
    if (!parsed.success) return;
    const now = Date.now();
    if (parsed.data.isTyping && socket.data.lastTypingAt && now - socket.data.lastTypingAt < TYPING_MIN_INTERVAL_MS) {
      return;
    }
    socket.data.lastTypingAt = now;
    try {
      const otherUserId = await this.partnerFor(socket, parsed.data.matchId);
      this.realtime.toUser(otherUserId, 'typing', {
        matchId: parsed.data.matchId,
        userId: socket.data.userId,
        isTyping: parsed.data.isTyping,
      });
    } catch {
      // Üyesi olunmayan match için typing sessizce yok sayılır.
    }
  }

  @SubscribeMessage('message:send')
  async onSend(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() body: unknown,
  ): Promise<ApiResponse<ChatMessageDto>> {
    const parsed = sendPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Mesaj geçersiz.',
          details: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        },
      };
    }
    try {
      const data = await this.chat.send(socket.data.userId, parsed.data.matchId, parsed.data.message);
      return { success: true, data };
    } catch (error) {
      if (!(error instanceof HttpException)) this.logger.error({ err: error }, 'WebSocket mesaj gönderimi başarısız');
      return failure(error);
    }
  }
}
