import { HttpStatus, Injectable } from '@nestjs/common';
import { type Gender, Prisma, type RelationshipIntention } from '@dating/database';
import type { DiscoveryCardDto, DiscoveryFeedDto } from '@dating/types';
import { type DiscoveryQueryInput, MAX_DISTANCE_KM, calculateAge } from '@dating/validation';
import { AppException } from '../../common/http/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { EntitlementsService } from '../billing/entitlements.service';
import { publicProfileInclude, toPublicProfileDto } from '../profiles/public-profile.mapper';
import { REPORT_WINDOW_DAYS } from '../safety/reports.service';
import { StorageService } from '../storage/storage.service';
import { type RankingCandidate, displayDistance, rankCandidates } from './ranking';

/** Pass edilen profiller bu süreden sonra tekrar gösterilebilir. */
export const PASS_RECYCLE_DAYS = 30;
const CANDIDATE_POOL_SIZE = 300;
/** Bu kadar farklı kişiden açık şikayet alan profil tam risk cezası alır (spec Bölüm 17 reportPenalty). */
const RISK_REPORTERS_FOR_MAX_PENALTY = 3;
const KM_PER_DEGREE_LAT = 111.32;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function yearsAgo(now: Date, years: number): Date {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export interface DiscoveryViewer {
  userId: string;
  gender: Gender;
  age: number;
  /** Passport aktifse seçilen şehrin koordinatları. */
  latitude: number;
  longitude: number;
  interestedIn: Gender[];
  ageMin: number;
  ageMax: number;
  maxDistanceKm: number;
  /** Gelişmiş filtreler (yalnızca entitlement varsa dolu). */
  verifiedOnly: boolean;
  intentions: RelationshipIntention[];
}

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * Discovery ve swipe için gereken, onboarding'i bitmiş kullanıcı bilgisi.
   * `premium` ile Passport ve gelişmiş filtreler, entitlement'a göre uygulanır.
   */
  async loadViewer(userId: string, options: { premium?: boolean } = {}): Promise<DiscoveryViewer> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, preferences: true },
    });
    const profile = user?.profile;
    const preferences = user?.preferences;
    if (
      !user ||
      !profile?.onboardingCompletedAt ||
      !preferences ||
      profile.latitude === null ||
      profile.longitude === null
    ) {
      throw new AppException('CONFLICT', 'Keşfetmeye başlamak için profilini tamamla.', HttpStatus.CONFLICT);
    }
    const viewer: DiscoveryViewer = {
      userId,
      gender: profile.gender,
      age: calculateAge(user.birthDate),
      latitude: profile.latitude,
      longitude: profile.longitude,
      interestedIn: preferences.interestedIn,
      ageMin: preferences.ageMin,
      ageMax: preferences.ageMax,
      maxDistanceKm: preferences.maxDistanceKm,
      verifiedOnly: false,
      intentions: [],
    };
    if (!options.premium) return viewer;

    const usesPassport = preferences.passportLatitude !== null && preferences.passportLongitude !== null;
    const usesFilters = preferences.verifiedOnly || preferences.intentions.length > 0;
    if (!usesPassport && !usesFilters) return viewer;
    const { features } = await this.entitlements.resolve(userId);
    if (usesPassport && features.passport) {
      viewer.latitude = preferences.passportLatitude ?? viewer.latitude;
      viewer.longitude = preferences.passportLongitude ?? viewer.longitude;
    }
    if (features.advancedFilters) {
      viewer.verifiedOnly = preferences.verifiedOnly;
      viewer.intentions = preferences.intentions;
    }
    return viewer;
  }

  async feed(userId: string, query: DiscoveryQueryInput): Promise<DiscoveryFeedDto> {
    const viewer = await this.loadViewer(userId, { premium: true });
    void this.activity.touch(userId);

    const candidates = await this.findCandidates(viewer, query.exclude);
    const ranked = rankCandidates(candidates, viewer.maxDistanceKm).slice(0, query.limit);
    const cards = await this.hydrate(viewer.userId, ranked);

    return {
      cards,
      suggestions: cards.length > 0 ? [] : this.suggestionsFor(viewer),
    };
  }

  private suggestionsFor(viewer: DiscoveryViewer): DiscoveryFeedDto['suggestions'] {
    const suggestions: DiscoveryFeedDto['suggestions'] = [];
    if (viewer.maxDistanceKm < MAX_DISTANCE_KM) suggestions.push('INCREASE_DISTANCE');
    if (viewer.ageMax - viewer.ageMin < 20) suggestions.push('WIDEN_AGE_RANGE');
    suggestions.push('TRY_LATER');
    return suggestions;
  }

  async findCandidates(viewer: DiscoveryViewer, exclude: string[] = []): Promise<RankingCandidate[]> {
    const now = new Date();
    const viewerId = viewer.userId;
    const { latitude: lat, longitude: lon, maxDistanceKm } = viewer;

    const latDelta = maxDistanceKm / KM_PER_DEGREE_LAT;
    const lonDelta = maxDistanceKm / (KM_PER_DEGREE_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
    const lonFilter =
      lon - lonDelta < -180 || lon + lonDelta > 180
        ? Prisma.empty
        : Prisma.sql`AND p.longitude BETWEEN ${lon - lonDelta} AND ${lon + lonDelta}`;
    const excludeFilter =
      exclude.length > 0 ? Prisma.sql`AND NOT (p."userId" = ANY(${exclude}::uuid[]))` : Prisma.empty;
    const verifiedFilter = viewer.verifiedOnly ? Prisma.sql`AND p."verificationStatus" = 'VERIFIED'` : Prisma.empty;
    const intentionFilter =
      viewer.intentions.length > 0
        ? Prisma.sql`AND p."relationshipIntention" = ANY(${viewer.intentions}::"RelationshipIntention"[])`
        : Prisma.empty;

    const youngestBirthDate = isoDate(yearsAgo(now, viewer.ageMin));
    const oldestBirthDateExclusive = isoDate(yearsAgo(now, viewer.ageMax + 1));
    const passCutoff = new Date(now.getTime() - PASS_RECYCLE_DAYS * 24 * 60 * 60 * 1000);
    const reportCutoff = new Date(now.getTime() - REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.$queryRaw<RankingCandidate[]>`
      SELECT * FROM (
        SELECT
          p."userId" AS "userId",
          6371 * 2 * asin(sqrt(
            power(sin(radians(p.latitude - ${lat}) / 2), 2) +
            cos(radians(${lat})) * cos(radians(p.latitude)) * power(sin(radians(p.longitude - ${lon}) / 2), 2)
          )) AS "distanceKm",
          p."lastActiveAt" AS "lastActiveAt",
          p."onboardingCompletedAt" AS "onboardingCompletedAt",
          (SELECT count(*)::int FROM user_photos ph
            WHERE ph."userId" = p."userId" AND ph.status = 'APPROVED') AS "approvedPhotoCount",
          coalesce(length(p.bio), 0)::int AS "bioLength",
          (SELECT count(*)::int FROM user_interests ui WHERE ui."userId" = p."userId") AS "interestCount",
          (SELECT count(*)::int FROM user_interests ui
            WHERE ui."userId" = p."userId"
              AND ui."interestId" IN (SELECT "interestId" FROM user_interests WHERE "userId" = ${viewerId}::uuid)
          ) AS "commonInterestCount",
          EXISTS (SELECT 1 FROM swipes s
            WHERE s."actorUserId" = p."userId" AND s."targetUserId" = ${viewerId}::uuid
              AND s.action IN ('LIKE', 'SUPER_LIKE')) AS "likedViewer",
          EXISTS (SELECT 1 FROM swipes s
            WHERE s."actorUserId" = p."userId" AND s."targetUserId" = ${viewerId}::uuid
              AND s.action = 'SUPER_LIKE') AS "superLikedViewer",
          greatest(
            CASE WHEN EXISTS (SELECT 1 FROM boosts bo WHERE bo."userId" = p."userId" AND bo."endsAt" > ${now})
              THEN 1 ELSE 0 END,
            coalesce((SELECT pl."visibilityBoost" FROM subscriptions sub
              JOIN subscription_plans pl ON pl.id = sub."planId"
              WHERE sub."userId" = p."userId"
                AND ((sub.status = 'ACTIVE' AND sub."currentPeriodEnd" > ${now})
                  OR (sub.status = 'PAST_DUE' AND sub."graceUntil" > ${now}))
              LIMIT 1), 0)
          )::float AS "boostFactor",
          EXISTS (SELECT 1 FROM swipes s
            WHERE s."actorUserId" = ${viewerId}::uuid AND s."targetUserId" = p."userId"
              AND s.action = 'PASS') AS "previouslyPassed",
          least(1.0, (SELECT count(DISTINCT r."reporterId") FROM reports r
            WHERE r."reportedUserId" = p."userId" AND r.status IN ('OPEN', 'REVIEWING')
              AND r."createdAt" > ${reportCutoff}
          )::float / ${RISK_REPORTERS_FOR_MAX_PENALTY}) AS "riskFactor"
        FROM user_profiles p
        JOIN users u ON u.id = p."userId"
        JOIN user_preferences pr ON pr."userId" = p."userId"
        WHERE p."userId" <> ${viewerId}::uuid
          AND p."onboardingCompletedAt" IS NOT NULL
          AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
          AND u.status = 'ACTIVE' AND u."deletedAt" IS NULL
          AND p.gender = ANY(${viewer.interestedIn}::"Gender"[])
          AND ${viewer.gender}::"Gender" = ANY(pr."interestedIn")
          AND u."birthDate" <= ${youngestBirthDate}::date
          AND u."birthDate" > ${oldestBirthDateExclusive}::date
          AND pr."ageMin" <= ${viewer.age} AND pr."ageMax" >= ${viewer.age}
          AND p.latitude BETWEEN ${lat - latDelta} AND ${lat + latDelta}
          ${lonFilter}
          ${excludeFilter}
          ${verifiedFilter}
          ${intentionFilter}
          AND (p.incognito = false OR EXISTS (SELECT 1 FROM swipes s
            WHERE s."actorUserId" = p."userId" AND s."targetUserId" = ${viewerId}::uuid
              AND s.action IN ('LIKE', 'SUPER_LIKE')))
          AND EXISTS (SELECT 1 FROM user_photos ph WHERE ph."userId" = p."userId" AND ph.status = 'APPROVED')
          AND NOT EXISTS (SELECT 1 FROM swipes s
            WHERE s."actorUserId" = ${viewerId}::uuid AND s."targetUserId" = p."userId"
              AND (s.action <> 'PASS' OR s."updatedAt" > ${passCutoff}))
          AND NOT EXISTS (SELECT 1 FROM blocks b
            WHERE (b."blockerId" = ${viewerId}::uuid AND b."blockedId" = p."userId")
               OR (b."blockerId" = p."userId" AND b."blockedId" = ${viewerId}::uuid))
      ) candidates
      WHERE candidates."distanceKm" <= ${maxDistanceKm}
      ORDER BY candidates."lastActiveAt" DESC NULLS LAST
      LIMIT ${CANDIDATE_POOL_SIZE}
    `;
    return rows;
  }

  private async hydrate(
    viewerId: string,
    ranked: Array<Pick<RankingCandidate, 'userId' | 'distanceKm' | 'superLikedViewer'>>,
  ): Promise<DiscoveryCardDto[]> {
    if (ranked.length === 0) return [];
    const [profiles, viewerInterests] = await Promise.all([
      this.prisma.userProfile.findMany({
        where: { userId: { in: ranked.map((candidate) => candidate.userId) } },
        include: publicProfileInclude,
      }),
      this.prisma.userInterest.findMany({ where: { userId: viewerId }, select: { interestId: true } }),
    ]);
    const byId = new Map(profiles.map((profile) => [profile.userId, profile]));
    const mine = new Set(viewerInterests.map((item) => item.interestId));
    const publicUrl = (key: string) => this.storage.publicUrl(key);

    return ranked.flatMap((candidate) => {
      const profile = byId.get(candidate.userId);
      if (!profile) return [];
      return [
        {
          ...toPublicProfileDto(profile, publicUrl),
          distanceKm: profile.hideDistance ? null : displayDistance(candidate.distanceKm),
          commonInterests: profile.user.interests
            .filter(({ interestId }) => mine.has(interestId))
            .map(({ interest }) => interest.slug),
          superLikedYou: candidate.superLikedViewer ?? false,
        },
      ];
    });
  }

  /**
   * Belirli kullanıcılar için kart (Rewind ile geri gelen kart, "seni beğenenler" listesi).
   * Görünürlük kuralları (aktif hesap, onboarding, onaylı foto, engel) yine uygulanır; sıra korunur.
   */
  async cardsFor(viewer: DiscoveryViewer, userIds: string[]): Promise<DiscoveryCardDto[]> {
    if (userIds.length === 0) return [];
    const [profiles, superLikes] = await Promise.all([
      this.prisma.userProfile.findMany({
        where: {
          userId: { in: userIds },
          onboardingCompletedAt: { not: null },
          latitude: { not: null },
          longitude: { not: null },
          user: {
            status: 'ACTIVE',
            deletedAt: null,
            photos: { some: { status: 'APPROVED' } },
            blocksMade: { none: { blockedId: viewer.userId } },
            blocksReceived: { none: { blockerId: viewer.userId } },
          },
        },
        select: { userId: true, latitude: true, longitude: true },
      }),
      this.prisma.swipe.findMany({
        where: { actorUserId: { in: userIds }, targetUserId: viewer.userId, action: 'SUPER_LIKE' },
        select: { actorUserId: true },
      }),
    ]);
    const visible = new Map(profiles.map((profile) => [profile.userId, profile]));
    const superLiked = new Set(superLikes.map((swipe) => swipe.actorUserId));
    const ordered = userIds.flatMap((userId) => {
      const profile = visible.get(userId);
      if (!profile || profile.latitude === null || profile.longitude === null) return [];
      return [
        {
          userId,
          distanceKm: haversineKm(viewer.latitude, viewer.longitude, profile.latitude, profile.longitude),
          superLikedViewer: superLiked.has(userId),
        },
      ];
    });
    return this.hydrate(viewer.userId, ordered);
  }
}
