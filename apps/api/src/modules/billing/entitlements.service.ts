import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { EntitlementSource, EntitlementType, SubscriptionPlan } from '@dating/database';
import type { EntitlementsDto, LikeAllowanceDto } from '@dating/types';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { AppException } from '../../common/http/app.exception';
import type { DbClient } from '../../infra/prisma/prisma-errors';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { REDIS } from '../../infra/redis/redis.module';
import { CatalogService } from './catalog.service';
import { dayKey, monthWindow, nextDayReset, weekWindow } from './periods';
import { type SubscriptionWithPlan, toSubscriptionDto } from './subscription.mapper';

export type Feature = keyof EntitlementsDto['features'];

const LOCKED_MESSAGES: Record<Feature, string> = {
  rewind: 'Rewind Plus ve Premium paketlerinde var.',
  seeLikes: 'Seni beğenenleri görmek için Premium’a geç.',
  incognito: 'Incognito Premium paketinde var.',
  passport: 'Passport Premium paketinde var.',
  advancedFilters: 'Gelişmiş filtreler Plus ve Premium paketlerinde var.',
  adFree: 'Reklamsız deneyim Plus ve Premium paketlerinde var.',
};

/** Spec Bölüm 14 "Feature override": admin/kampanya ile kullanıcı bazlı değer. */
const overrideSchemas = {
  dailyLikeLimit: z.number().int().nonnegative().nullable(),
  rewind: z.boolean(),
  seeLikes: z.boolean(),
  incognito: z.boolean(),
  passport: z.boolean(),
  advancedFilters: z.boolean(),
  adFree: z.boolean(),
} as const;

export const OVERRIDABLE_FEATURES = Object.keys(overrideSchemas) as Array<keyof typeof overrideSchemas>;

const SAFE_DECREMENT = `
local value = tonumber(redis.call('GET', KEYS[1]) or '0')
if value > 0 then return redis.call('DECR', KEYS[1]) end
return 0`;

export interface ResolvedEntitlements {
  plan: SubscriptionPlan;
  subscription: SubscriptionWithPlan | null;
  features: EntitlementsDto['features'];
  dailyLikeLimit: number | null;
}

function likeKey(userId: string, at: Date): string {
  return `likes:${userId}:${dayKey(at)}`;
}

/**
 * Merkezi entitlement servisi (spec Bölüm 14): tüm premium/limit kontrolleri buradan geçer.
 * Sıra: aktif abonelik → plan → limit → kullanım → override.
 */
@Injectable()
export class EntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** ACTIVE dönem içinde ya da PAST_DUE grace period içinde olan abonelik. */
  activeSubscription(userId: string, now = new Date(), db: DbClient = this.prisma): Promise<SubscriptionWithPlan | null> {
    return db.subscription.findFirst({
      where: {
        userId,
        OR: [
          { status: 'ACTIVE', currentPeriodEnd: { gt: now } },
          { status: 'PAST_DUE', graceUntil: { gt: now } },
        ],
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolve(userId: string, now = new Date()): Promise<ResolvedEntitlements> {
    const [subscription, overrides] = await Promise.all([
      this.activeSubscription(userId, now),
      this.prisma.featureOverride.findMany({
        where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      }),
    ]);
    const plan = subscription?.plan ?? (await this.catalog.freePlan());
    const resolved: ResolvedEntitlements = {
      plan,
      subscription,
      dailyLikeLimit: plan.swipeLimit,
      features: {
        rewind: plan.rewindEnabled,
        seeLikes: plan.seeLikesEnabled,
        incognito: plan.incognitoEnabled,
        passport: plan.passportEnabled,
        advancedFilters: plan.advancedFiltersEnabled,
        adFree: plan.adFree,
      },
    };
    for (const override of overrides) {
      if (override.feature === 'dailyLikeLimit') {
        const parsed = overrideSchemas.dailyLikeLimit.safeParse(override.value);
        if (parsed.success) resolved.dailyLikeLimit = parsed.data;
      } else if (override.feature in resolved.features) {
        const parsed = z.boolean().safeParse(override.value);
        if (parsed.success) resolved.features[override.feature as Feature] = parsed.data;
      }
    }
    return resolved;
  }

  async hasFeature(userId: string, feature: Feature): Promise<boolean> {
    return (await this.resolve(userId)).features[feature];
  }

  async assertFeature(userId: string, feature: Feature): Promise<void> {
    if (!(await this.hasFeature(userId, feature))) {
      throw new AppException('FEATURE_LOCKED', LOCKED_MESSAGES[feature], HttpStatus.FORBIDDEN);
    }
  }

  async likeAllowance(userId: string, now = new Date(), resolved?: ResolvedEntitlements): Promise<LikeAllowanceDto> {
    const { dailyLikeLimit: limit } = resolved ?? (await this.resolve(userId, now));
    const used = Number((await this.redis.get(likeKey(userId, now))) ?? 0);
    const remaining = limit === null ? null : Math.max(0, limit - used);
    return { allowed: remaining === null || remaining > 0, limit, remaining, resetAt: nextDayReset(now).toISOString() };
  }

  /**
   * Günlük like hakkından bir tane ayırır (Redis INCR atomik; eşzamanlı istekler limiti aşamaz).
   * Swipe kaydedilmezse dönen `release` ile geri verilir.
   */
  async reserveLike(userId: string, now = new Date()): Promise<() => Promise<void>> {
    const { dailyLikeLimit: limit } = await this.resolve(userId, now);
    const key = likeKey(userId, now);
    const result = await this.redis
      .multi()
      .incr(key)
      .pexpireat(key, nextDayReset(now).getTime() + 60 * 60 * 1000)
      .exec();
    const count = Number(result?.[0]?.[1] ?? 0);
    const release = async (): Promise<void> => {
      await this.redis.eval(SAFE_DECREMENT, 1, key);
    };
    if (limit !== null && count > limit) {
      await release();
      throw new AppException('LIMIT_REACHED', 'Günlük like hakkın doldu.', HttpStatus.PAYMENT_REQUIRED);
    }
    return release;
  }

  /** Rewind: bugün yapılmış bir like geri alınırsa hakkı iade edilir. */
  async refundLike(userId: string, likedAt: Date, now = new Date()): Promise<void> {
    if (dayKey(likedAt) !== dayKey(now)) return;
    await this.redis.eval(SAFE_DECREMENT, 1, likeKey(userId, now));
  }

  /** Planın dönemsel Super Like / Boost haklarını (idempotent grantKey ile) oluşturur. */
  async ensurePeriodGrants(userId: string, now = new Date(), db: DbClient = this.prisma): Promise<void> {
    const subscription = await this.activeSubscription(userId, now, db);
    const plan = subscription?.plan ?? (await this.catalog.freePlan());
    const week = weekWindow(now);
    const grants: Array<{
      type: EntitlementType;
      quantity: number;
      source: EntitlementSource;
      grantKey: string;
      expiresAt: Date;
    }> = [];

    if (plan.superLikeLimit > 0) {
      grants.push({
        type: 'SUPER_LIKE',
        quantity: plan.superLikeLimit,
        source: subscription ? 'SUBSCRIPTION' : 'FREE_PLAN',
        grantKey: subscription ? `sub:${subscription.id}:SUPER_LIKE:${week.key}` : `free:SUPER_LIKE:${week.key}`,
        expiresAt: week.end,
      });
    }
    if (plan.boostLimit > 0) {
      const month = monthWindow(now);
      grants.push(
        subscription
          ? {
              type: 'BOOST',
              quantity: plan.boostLimit,
              source: 'SUBSCRIPTION',
              grantKey: `sub:${subscription.id}:BOOST:${subscription.currentPeriodStart.toISOString()}`,
              expiresAt: subscription.currentPeriodEnd,
            }
          : {
              type: 'BOOST',
              quantity: plan.boostLimit,
              source: 'FREE_PLAN',
              grantKey: `free:BOOST:${month.key}`,
              expiresAt: month.end,
            },
      );
    }
    if (grants.length === 0) return;
    await db.entitlement.createMany({
      data: grants.map((grant) => ({ userId, ...grant })),
      skipDuplicates: true,
    });
  }

  grant(
    db: DbClient,
    input: { userId: string; type: EntitlementType; quantity: number; source: EntitlementSource; grantKey?: string },
  ): Promise<unknown> {
    return db.entitlement.createMany({
      data: [{ ...input, grantKey: input.grantKey ?? null }],
      skipDuplicates: true,
    });
  }

  /**
   * Bir hakkı atomik olarak düşer: en erken sona erecek geçerli kayıttan 1 azaltır.
   * Dış WHERE'deki `quantity > 0` eşzamanlı istekte satır kilidi bırakıldıktan sonra yeniden değerlendirilir;
   * böylece aynı son hak iki kez harcanamaz (spec Bölüm 16).
   */
  async consume(db: DbClient, userId: string, type: EntitlementType, now = new Date()): Promise<boolean> {
    await this.ensurePeriodGrants(userId, now, db);
    const rows = await db.$queryRaw<Array<{ id: string }>>`
      UPDATE entitlements SET quantity = quantity - 1, "updatedAt" = now()
      WHERE quantity > 0 AND id = (
        SELECT id FROM entitlements
        WHERE "userId" = ${userId}::uuid AND type = ${type}::"EntitlementType" AND quantity > 0
          AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
        ORDER BY "expiresAt" ASC NULLS LAST, "createdAt" ASC
        LIMIT 1
        FOR UPDATE
      )
      RETURNING id`;
    return rows.length > 0;
  }

  async remaining(userId: string, type: EntitlementType, now = new Date(), db: DbClient = this.prisma): Promise<number> {
    const result = await db.entitlement.aggregate({
      where: { userId, type, quantity: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }

  /** Abonelik bitince o aboneliğin dönemsel hakları geçersiz olur; satın alınanlar kalır. */
  revokeSubscriptionGrants(db: DbClient, subscriptionId: string): Promise<unknown> {
    return db.entitlement.updateMany({
      where: { grantKey: { startsWith: `sub:${subscriptionId}:` }, quantity: { gt: 0 } },
      data: { quantity: 0 },
    });
  }

  async summary(userId: string, now = new Date()): Promise<EntitlementsDto> {
    const resolved = await this.resolve(userId, now);
    await this.ensurePeriodGrants(userId, now);
    const [likes, superLikes, boosts, activeBoost] = await Promise.all([
      this.likeAllowance(userId, now, resolved),
      this.remaining(userId, 'SUPER_LIKE', now),
      this.remaining(userId, 'BOOST', now),
      this.prisma.boost.findFirst({
        where: { userId, endsAt: { gt: now } },
        orderBy: { endsAt: 'desc' },
        select: { endsAt: true },
      }),
    ]);
    return {
      plan: { slug: resolved.plan.slug, name: resolved.plan.name },
      subscription: resolved.subscription ? toSubscriptionDto(resolved.subscription) : null,
      features: resolved.features,
      likes,
      superLikes: { remaining: superLikes },
      boosts: { remaining: boosts, activeUntil: activeBoost?.endsAt.toISOString() ?? null },
    };
  }
}
