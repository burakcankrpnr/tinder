import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { BlockedUserDto } from '@dating/types';
import {
  DomainEvent,
  type MatchEndedEvent,
  type UserBlockedEvent,
} from '../../common/events/domain-events';
import { AppException } from '../../common/http/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { orderedPair } from '../matches/match.mapper';
import { variantUrls } from '../photos/photo.mapper';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class BlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  /** İki yönden herhangi birinde engel varsa true. */
  async isBlockedBetween(first: string, second: string): Promise<boolean> {
    const count = await this.prisma.block.count({
      where: {
        OR: [
          { blockerId: first, blockedId: second },
          { blockerId: second, blockedId: first },
        ],
      },
    });
    return count > 0;
  }

  /**
   * Idempotent: tekrar engelleme hata vermez. Aktif match varsa BLOCKED'a çekilir;
   * engel kaldırılsa bile match geri açılmaz.
   */
  async block(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new AppException('BAD_REQUEST', 'Kendini engelleyemezsin.', HttpStatus.BAD_REQUEST);
    }
    const target = await this.prisma.user.findFirst({
      where: { id: blockedId, deletedAt: null },
      select: { id: true },
    });
    if (!target) throw AppException.notFound('Kullanıcı bulunamadı.');

    const pair = orderedPair(blockerId, blockedId);
    const { created, endedMatchId } = await this.prisma.$transaction(async (tx) => {
      const inserted = await tx.block.createMany({
        data: [{ blockerId, blockedId }],
        skipDuplicates: true,
      });
      const match = await tx.match.findUnique({ where: { userAId_userBId: pair }, select: { id: true } });
      let ended: string | null = null;
      if (match) {
        const updated = await tx.match.updateMany({
          where: { id: match.id, status: 'ACTIVE' },
          data: { status: 'BLOCKED', endedAt: new Date(), endedById: blockerId },
        });
        if (updated.count > 0) ended = match.id;
      }
      return { created: inserted.count > 0, endedMatchId: ended };
    });

    if (created) {
      await this.audit.log({
        actorUserId: blockerId,
        action: 'safety.user_blocked',
        targetType: 'user',
        targetId: blockedId,
      });
      const event: UserBlockedEvent = { blockerId, blockedId };
      this.events.emit(DomainEvent.USER_BLOCKED, event);
    }
    if (endedMatchId) {
      const event: MatchEndedEvent = {
        matchId: endedMatchId,
        userIds: [pair.userAId, pair.userBId],
        endedById: blockerId,
        reason: 'BLOCKED',
      };
      this.events.emit(DomainEvent.MATCH_ENDED, event);
    }
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    const removed = await this.prisma.block.deleteMany({ where: { blockerId, blockedId } });
    if (removed.count > 0) {
      await this.audit.log({
        actorUserId: blockerId,
        action: 'safety.user_unblocked',
        targetType: 'user',
        targetId: blockedId,
      });
    }
  }

  async list(blockerId: string): Promise<BlockedUserDto[]> {
    const blocks = await this.prisma.block.findMany({
      where: { blockerId },
      orderBy: { createdAt: 'desc' },
      include: {
        blocked: {
          select: {
            id: true,
            profile: { select: { firstName: true, username: true } },
            photos: { where: { status: 'APPROVED' }, orderBy: { position: 'asc' }, take: 1 },
          },
        },
      },
    });
    const publicUrl = (key: string) => this.storage.publicUrl(key);
    return blocks.map(({ blocked, createdAt }) => {
      const photo = blocked.photos[0];
      return {
        userId: blocked.id,
        firstName: blocked.profile?.firstName ?? '',
        username: blocked.profile?.username ?? '',
        photo: photo ? variantUrls(photo, publicUrl) : null,
        blockedAt: createdAt.toISOString(),
      };
    });
  }
}
