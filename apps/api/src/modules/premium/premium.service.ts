import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma } from '@dating/database';
import type { BoostDto, LikesReceivedDto, PremiumSettingsDto } from '@dating/types';
import { type PremiumSettingsInput, findKnownCity } from '@dating/validation';
import { type BoostActivatedEvent, DomainEvent } from '../../common/events/domain-events';
import { AppException } from '../../common/http/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { EntitlementsService, type Feature } from '../billing/entitlements.service';
import { DiscoveryService, PASS_RECYCLE_DAYS } from '../discovery/discovery.service';

export const BOOST_DURATION_MINUTES = 30;
const LIKES_PAGE_SIZE = 50;

@Injectable()
export class PremiumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly discovery: DiscoveryService,
    private readonly events: EventEmitter2,
  ) {}

  /** Boost envanterinden bir hak harcar; aynı anda tek aktif Boost (kullanıcı başına advisory lock). */
  async activateBoost(userId: string): Promise<BoostDto> {
    await this.discovery.loadViewer(userId);
    const now = new Date();
    const boost = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`boost:${userId}`}))`;
      const active = await tx.boost.findFirst({ where: { userId, endsAt: { gt: now } }, select: { id: true } });
      if (active) throw new AppException('CONFLICT', 'Zaten aktif bir Boost’un var.', HttpStatus.CONFLICT);
      if (!(await this.entitlements.consume(tx, userId, 'BOOST', now))) {
        throw new AppException('LIMIT_REACHED', 'Boost hakkın yok.', HttpStatus.PAYMENT_REQUIRED);
      }
      return tx.boost.create({
        data: { userId, startedAt: now, endsAt: new Date(now.getTime() + BOOST_DURATION_MINUTES * 60 * 1000) },
      });
    });
    const event: BoostActivatedEvent = { userId, endsAt: boost.endsAt.toISOString() };
    this.events.emit(DomainEvent.BOOST_ACTIVATED, event);
    return { startedAt: boost.startedAt.toISOString(), endsAt: boost.endsAt.toISOString() };
  }

  /**
   * Seni beğenen ama henüz karşılık vermediğin kişiler. Paket "beğenenleri gör" içermiyorsa
   * yalnızca sayı döner; kim olduğu bilgisi API'den hiç çıkmaz.
   */
  async likesReceived(userId: string): Promise<LikesReceivedDto> {
    const viewer = await this.discovery.loadViewer(userId, { premium: true });
    const passCutoff = new Date(Date.now() - PASS_RECYCLE_DAYS * 24 * 60 * 60 * 1000);
    const where: Prisma.SwipeWhereInput = {
      targetUserId: userId,
      action: { in: ['LIKE', 'SUPER_LIKE'] },
      actor: {
        status: 'ACTIVE',
        deletedAt: null,
        profile: { onboardingCompletedAt: { not: null } },
        photos: { some: { status: 'APPROVED' } },
        blocksMade: { none: { blockedId: userId } },
        blocksReceived: { none: { blockerId: userId } },
        swipesReceived: {
          none: { actorUserId: userId, OR: [{ action: { not: 'PASS' } }, { updatedAt: { gt: passCutoff } }] },
        },
      },
    };
    const [total, canSee] = await Promise.all([
      this.prisma.swipe.count({ where }),
      this.entitlements.hasFeature(userId, 'seeLikes'),
    ]);
    if (!canSee) return { locked: true, total, items: [] };

    const swipes = await this.prisma.swipe.findMany({
      where,
      orderBy: [{ action: 'desc' }, { updatedAt: 'desc' }],
      take: LIKES_PAGE_SIZE,
      select: { actorUserId: true, updatedAt: true },
    });
    const likedAt = new Map(swipes.map((swipe) => [swipe.actorUserId, swipe.updatedAt.toISOString()]));
    const cards = await this.discovery.cardsFor(
      viewer,
      swipes.map((swipe) => swipe.actorUserId),
    );
    return {
      locked: false,
      total,
      items: cards.map((card) => ({ ...card, likedAt: likedAt.get(card.id) ?? new Date().toISOString() })),
    };
  }

  async settings(userId: string): Promise<PremiumSettingsDto> {
    const [profile, preferences] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { userId }, select: { incognito: true } }),
      this.prisma.userPreferences.findUnique({
        where: { userId },
        select: { passportCity: true, verifiedOnly: true, intentions: true },
      }),
    ]);
    return {
      incognito: profile?.incognito ?? false,
      passportCity: preferences?.passportCity ?? null,
      verifiedOnly: preferences?.verifiedOnly ?? false,
      intentions: preferences?.intentions ?? [],
    };
  }

  /** Açmak entitlement ister; kapatmak her zaman serbesttir (abonelik bitse bile kullanıcı temizleyebilir). */
  async updateSettings(userId: string, input: PremiumSettingsInput): Promise<PremiumSettingsDto> {
    const required = new Set<Feature>();
    if (input.incognito === true) required.add('incognito');
    if (input.passportCity) required.add('passport');
    if (input.verifiedOnly === true || (input.intentions && input.intentions.length > 0)) {
      required.add('advancedFilters');
    }
    for (const feature of required) await this.entitlements.assertFeature(userId, feature);

    const preferences = await this.prisma.userPreferences.findUnique({ where: { userId }, select: { userId: true } });
    if (!preferences) {
      throw new AppException('CONFLICT', 'Önce keşif tercihlerini tamamla.', HttpStatus.CONFLICT);
    }

    const city = input.passportCity ? findKnownCity(input.passportCity) : undefined;
    const preferenceData: Prisma.UserPreferencesUpdateInput = {
      ...(input.passportCity !== undefined && {
        passportCity: city?.name ?? null,
        passportLatitude: city?.latitude ?? null,
        passportLongitude: city?.longitude ?? null,
      }),
      ...(input.verifiedOnly !== undefined && { verifiedOnly: input.verifiedOnly }),
      ...(input.intentions !== undefined && { intentions: input.intentions }),
    };
    await this.prisma.$transaction([
      ...(input.incognito !== undefined
        ? [this.prisma.userProfile.update({ where: { userId }, data: { incognito: input.incognito } })]
        : []),
      ...(Object.keys(preferenceData).length > 0
        ? [this.prisma.userPreferences.update({ where: { userId }, data: preferenceData })]
        : []),
    ]);
    return this.settings(userId);
  }
}
