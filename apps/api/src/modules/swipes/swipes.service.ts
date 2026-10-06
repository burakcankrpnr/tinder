import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Match, Swipe } from '@dating/database';
import type { RewindResultDto, SwipeResultDto } from '@dating/types';
import type { SwipeInput } from '@dating/validation';
import {
  DomainEvent,
  type MatchCreatedEvent,
  type SuperLikeUsedEvent,
  type SwipeCreatedEvent,
} from '../../common/events/domain-events';
import { AppException } from '../../common/http/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { EntitlementsService } from '../billing/entitlements.service';
import { DiscoveryService, PASS_RECYCLE_DAYS } from '../discovery/discovery.service';
import { matchUserSelect, orderedPair, toMatchUserDto } from '../matches/match.mapper';
import { BlocksService } from '../safety/blocks.service';
import { StorageService } from '../storage/storage.service';

const POSITIVE_ACTIONS = new Set<Swipe['action']>(['LIKE', 'SUPER_LIKE']);

interface SwipeOutcome {
  swipe: Swipe;
  changed: boolean;
  match: Match | null;
  matchCreated: boolean;
}

@Injectable()
export class SwipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: DiscoveryService,
    private readonly activity: ActivityService,
    private readonly storage: StorageService,
    private readonly blocks: BlocksService,
    private readonly entitlements: EntitlementsService,
    private readonly events: EventEmitter2,
  ) {}

  async swipe(actorUserId: string, input: SwipeInput): Promise<SwipeResultDto> {
    if (input.targetUserId === actorUserId) {
      throw new AppException('BAD_REQUEST', 'Kendini beğenemezsin.', HttpStatus.BAD_REQUEST);
    }
    await this.discovery.loadViewer(actorUserId);
    await this.assertTargetVisible(actorUserId, input.targetUserId);

    const release = input.action === 'LIKE' ? await this.entitlements.reserveLike(actorUserId) : null;
    let outcome: SwipeOutcome;
    try {
      outcome = await this.record(actorUserId, input);
    } catch (error) {
      await release?.();
      throw error;
    }
    if (release && !outcome.changed) await release();
    void this.activity.touch(actorUserId);

    if (outcome.changed) {
      const event: SwipeCreatedEvent = {
        swipeId: outcome.swipe.id,
        actorUserId,
        targetUserId: input.targetUserId,
        action: outcome.swipe.action,
      };
      this.events.emit(DomainEvent.SWIPE_CREATED, event);
      if (outcome.swipe.action === 'SUPER_LIKE') {
        const used: SuperLikeUsedEvent = { userId: actorUserId, targetUserId: input.targetUserId };
        this.events.emit(DomainEvent.SUPER_LIKE_USED, used);
      }
    }
    if (outcome.match && outcome.matchCreated) {
      const event: MatchCreatedEvent = {
        matchId: outcome.match.id,
        userIds: [outcome.match.userAId, outcome.match.userBId],
        createdAt: outcome.match.createdAt.toISOString(),
      };
      this.events.emit(DomainEvent.MATCH_CREATED, event);
    }

    return {
      action: outcome.swipe.action,
      match: outcome.match ? await this.matchSummary(outcome.match, input.targetUserId) : null,
    };
  }

  private async assertTargetVisible(actorUserId: string, targetUserId: string): Promise<void> {
    const [target, blocked] = await Promise.all([
      this.prisma.userProfile.findFirst({
        where: {
          userId: targetUserId,
          onboardingCompletedAt: { not: null },
          user: { status: 'ACTIVE', deletedAt: null },
        },
        select: { userId: true },
      }),
      this.blocks.isBlockedBetween(actorUserId, targetUserId),
    ]);
    if (!target || blocked) throw AppException.notFound('Profil bulunamadı.');
  }

  /**
   * Çift için advisory lock: A->B ve B->A aynı anda gelse bile karşılıklı like'ı
   * ikinci transaction görür ve tek match oluşur. (actor, target) unique olduğundan swipe tekrarlanamaz.
   */
  private record(actorUserId: string, input: SwipeInput): Promise<SwipeOutcome> {
    const { targetUserId, action } = input;
    const pair = orderedPair(actorUserId, targetUserId);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`swipe:${pair.userAId}:${pair.userBId}`}))`;

      const existing = await tx.swipe.findUnique({
        where: { actorUserId_targetUserId: { actorUserId, targetUserId } },
      });

      let swipe: Swipe;
      let changed = true;
      if (!existing) {
        swipe = await tx.swipe.create({ data: { actorUserId, targetUserId, action } });
      } else if (existing.action === action) {
        swipe = existing;
        changed = false;
      } else if (existing.action === 'PASS' && this.isRecyclable(existing)) {
        swipe = await tx.swipe.update({ where: { id: existing.id }, data: { action } });
      } else {
        throw new AppException('CONFLICT', 'Bu profil için zaten bir seçim yaptın.', HttpStatus.CONFLICT);
      }

      if (changed && swipe.action === 'SUPER_LIKE' && !(await this.entitlements.consume(tx, actorUserId, 'SUPER_LIKE'))) {
        throw new AppException('LIMIT_REACHED', 'Super Like hakkın kalmadı.', HttpStatus.PAYMENT_REQUIRED);
      }

      if (!POSITIVE_ACTIONS.has(swipe.action)) {
        return { swipe, changed, match: null, matchCreated: false };
      }

      const reverse = await tx.swipe.findUnique({
        where: { actorUserId_targetUserId: { actorUserId: targetUserId, targetUserId: actorUserId } },
      });
      if (!reverse || !POSITIVE_ACTIONS.has(reverse.action)) {
        return { swipe, changed, match: null, matchCreated: false };
      }

      const existingMatch = await tx.match.findUnique({ where: { userAId_userBId: pair } });
      if (existingMatch) {
        return {
          swipe,
          changed,
          match: existingMatch.status === 'ACTIVE' ? existingMatch : null,
          matchCreated: false,
        };
      }
      const match = await tx.match.create({ data: pair });
      return { swipe, changed, match, matchCreated: true };
    });
  }

  /**
   * Son swipe'ı geri alır (Plus/Premium). Match'e dönüşmüş seçim geri alınamaz.
   * Harcanan Super Like ve bugünkü like hakkı iade edilir.
   */
  async rewind(userId: string): Promise<RewindResultDto> {
    await this.entitlements.assertFeature(userId, 'rewind');
    const viewer = await this.discovery.loadViewer(userId, { premium: true });
    const last = await this.prisma.swipe.findFirst({
      where: { actorUserId: userId },
      orderBy: { updatedAt: 'desc' },
    });
    if (!last) throw AppException.notFound('Geri alınacak bir seçim yok.');
    const pair = orderedPair(userId, last.targetUserId);

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`swipe:${pair.userAId}:${pair.userBId}`}))`;
      const match = await tx.match.findUnique({ where: { userAId_userBId: pair }, select: { id: true } });
      if (match) {
        throw new AppException('CONFLICT', 'Eşleşmeyle sonuçlanan bir seçim geri alınamaz.', HttpStatus.CONFLICT);
      }
      const deleted = await tx.swipe.deleteMany({ where: { id: last.id, updatedAt: last.updatedAt } });
      if (deleted.count === 0) {
        throw new AppException('CONFLICT', 'Bu seçim zaten değişti, tekrar dene.', HttpStatus.CONFLICT);
      }
      if (last.action === 'SUPER_LIKE') {
        await this.entitlements.grant(tx, {
          userId,
          type: 'SUPER_LIKE',
          quantity: 1,
          source: 'REFUND',
          grantKey: `rewind:${last.id}`,
        });
      }
    });
    if (last.action === 'LIKE') await this.entitlements.refundLike(userId, last.updatedAt);

    const [card] = await this.discovery.cardsFor(viewer, [last.targetUserId]);
    return { card: card ?? null };
  }

  private isRecyclable(swipe: Swipe): boolean {
    return Date.now() - swipe.updatedAt.getTime() >= PASS_RECYCLE_DAYS * 24 * 60 * 60 * 1000;
  }

  private async matchSummary(match: Match, otherUserId: string): Promise<SwipeResultDto['match']> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: otherUserId },
      select: matchUserSelect,
    });
    return {
      id: match.id,
      createdAt: match.createdAt.toISOString(),
      user: toMatchUserDto(user, (key) => this.storage.publicUrl(key)),
    };
  }
}
