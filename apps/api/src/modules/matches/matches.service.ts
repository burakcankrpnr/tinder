import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Match } from '@dating/database';
import type { MatchDetailDto, MatchListDto, MatchListItemDto, MatchSummaryDto } from '@dating/types';
import { DomainEvent, type MatchEndedEvent } from '../../common/events/domain-events';
import { AppException } from '../../common/http/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PresenceService } from '../realtime/presence.service';
import { StorageService } from '../storage/storage.service';
import { matchUserSelect, toMatchUserDto } from './match.mapper';

const MAX_MATCHES = 200;
const PREVIEW_LENGTH = 80;

export interface MemberMatch {
  match: Match;
  otherUserId: string;
}

export function otherMember(match: Pick<Match, 'userAId' | 'userBId'>, userId: string): string {
  return match.userAId === userId ? match.userBId : match.userAId;
}

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly presence: PresenceService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  private publicUrl = (key: string): string => this.storage.publicUrl(key);

  /** Kullanıcının üyesi olduğu aktif match; değilse (veya bitmişse) 404. Varlık bilgisi sızdırılmaz. */
  async findActiveForMember(matchId: string, userId: string): Promise<MemberMatch> {
    const match = await this.prisma.match.findFirst({
      where: { id: matchId, status: 'ACTIVE', OR: [{ userAId: userId }, { userBId: userId }] },
    });
    if (!match) throw AppException.notFound('Eşleşme bulunamadı.');
    return { match, otherUserId: otherMember(match, userId) };
  }

  async activePartnerIds(userId: string): Promise<string[]> {
    const matches = await this.prisma.match.findMany({
      where: { status: 'ACTIVE', OR: [{ userAId: userId }, { userBId: userId }] },
      select: { userAId: true, userBId: true },
    });
    return matches.map((match) => otherMember(match, userId));
  }

  async summaryFor(matchId: string, viewerId: string): Promise<MatchSummaryDto> {
    const { match, otherUserId } = await this.findActiveForMember(matchId, viewerId);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: otherUserId }, select: matchUserSelect });
    return { id: match.id, createdAt: match.createdAt.toISOString(), user: toMatchUserDto(user, this.publicUrl) };
  }

  async list(userId: string): Promise<MatchListDto> {
    const matches = await this.prisma.match.findMany({
      where: { status: 'ACTIVE', OR: [{ userAId: userId }, { userBId: userId }] },
      include: {
        userA: { select: matchUserSelect },
        userB: { select: matchUserSelect },
        conversation: {
          select: {
            id: true,
            messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 },
          },
        },
      },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: MAX_MATCHES,
    });

    const conversationIds = matches.flatMap((match) => (match.conversation ? [match.conversation.id] : []));
    const unread = conversationIds.length
      ? await this.prisma.message.groupBy({
          by: ['conversationId'],
          where: {
            conversationId: { in: conversationIds },
            senderId: { not: userId },
            readAt: null,
            deletedAt: null,
          },
          _count: { _all: true },
        })
      : [];
    const unreadByConversation = new Map(unread.map((row) => [row.conversationId, row._count._all]));
    const online = await this.presence.onlineMap(matches.map((match) => otherMember(match, userId)));

    const items: MatchListItemDto[] = matches.map((match) => {
      const other = match.userAId === userId ? match.userB : match.userA;
      const last = match.conversation?.messages[0];
      return {
        id: match.id,
        createdAt: match.createdAt.toISOString(),
        user: toMatchUserDto(other, this.publicUrl),
        lastMessage: last
          ? {
              preview: last.deletedAt || last.type === 'IMAGE' ? '' : (last.body ?? '').slice(0, PREVIEW_LENGTH),
              type: last.type,
              fromMe: last.senderId === userId,
              createdAt: last.createdAt.toISOString(),
              deleted: last.deletedAt !== null,
            }
          : null,
        unreadCount: match.conversation ? (unreadByConversation.get(match.conversation.id) ?? 0) : 0,
        online: online.get(other.id) ?? false,
      };
    });
    return { matches: items };
  }

  async detail(matchId: string, userId: string): Promise<MatchDetailDto> {
    const { match, otherUserId } = await this.findActiveForMember(matchId, userId);
    const [user, profile, online] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: otherUserId }, select: matchUserSelect }),
      this.prisma.userProfile.findUnique({ where: { userId: otherUserId }, select: { lastActiveAt: true } }),
      this.presence.isOnline(otherUserId),
    ]);
    return {
      id: match.id,
      createdAt: match.createdAt.toISOString(),
      user: toMatchUserDto(user, this.publicUrl),
      online,
      lastActiveAt: profile?.lastActiveAt?.toISOString() ?? null,
    };
  }

  /** ACTIVE → UNMATCHED geçişi koşullu update ile tek sefer olur; eşzamanlı ikinci istek 404 alır. */
  async unmatch(matchId: string, userId: string): Promise<void> {
    const { match } = await this.findActiveForMember(matchId, userId);
    const updated = await this.prisma.match.updateMany({
      where: { id: match.id, status: 'ACTIVE' },
      data: { status: 'UNMATCHED', endedAt: new Date(), endedById: userId },
    });
    if (updated.count === 0) throw AppException.notFound('Eşleşme bulunamadı.');

    await this.audit.log({ actorUserId: userId, action: 'match.unmatched', targetType: 'match', targetId: match.id });
    const event: MatchEndedEvent = {
      matchId: match.id,
      userIds: [match.userAId, match.userBId],
      endedById: userId,
      reason: 'UNMATCHED',
    };
    this.events.emit(DomainEvent.MATCH_ENDED, event);
  }
}
