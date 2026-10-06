import { Injectable } from '@nestjs/common';
import { Prisma } from '@dating/database';
import type { AnalyticsKpiDto } from '@dating/types';
import type { AnalyticsQuery } from '@dating/validation';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { FREE_PLAN_SLUG } from '../billing/catalog.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 30;

interface Range {
  from: Date;
  /** Hariç (ertesi günün başı). */
  to: Date;
  days: number;
}

function rangeOf(query: AnalyticsQuery, now = new Date()): Range {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const to = query.to ? Date.parse(`${query.to}T00:00:00Z`) + DAY_MS : today + DAY_MS;
  const from = query.from ? Date.parse(`${query.from}T00:00:00Z`) : to - DEFAULT_RANGE_DAYS * DAY_MS;
  return { from: new Date(from), to: new Date(to), days: Math.max(1, Math.round((to - from) / DAY_MS)) };
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 10_000) / 10_000 : null;
}

type CountRow = { count: bigint | number | null };
const num = (rows: CountRow[]): number => Number(rows[0]?.count ?? 0);

/**
 * Spec Bölüm 31 KPI'ları ve Bölüm 32 filtreleri. Tüm hesaplar PostgreSQL üzerinden yapılır
 * (source of truth); aktiflik `analytics_events` + `lastActiveAt` ile ölçülür.
 */
@Injectable()
export class AnalyticsKpiService {
  constructor(private readonly prisma: PrismaService) {}

  /** Filtreye uyan kullanıcılar için CTE (`fu`). */
  private filteredUsers(query: AnalyticsQuery, now: Date): Prisma.Sql {
    const conditions: Prisma.Sql[] = [Prisma.sql`u."deletedAt" IS NULL`];
    if (query.country) conditions.push(Prisma.sql`p.country = ${query.country}`);
    if (query.city) conditions.push(Prisma.sql`lower(p.city) = lower(${query.city})`);
    if (query.status) conditions.push(Prisma.sql`u.status::text = ${query.status}`);
    if (query.platform) {
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM analytics_events pe WHERE pe."userId" = u.id AND pe.platform = ${query.platform})`,
      );
    }
    if (query.plan) {
      const live = Prisma.sql`EXISTS (
        SELECT 1 FROM subscriptions s JOIN subscription_plans sp ON sp.id = s."planId"
        WHERE s."userId" = u.id
          AND ((s.status = 'ACTIVE' AND s."currentPeriodEnd" > ${now}) OR (s.status = 'PAST_DUE' AND s."graceUntil" > ${now}))
          ${query.plan === FREE_PLAN_SLUG ? Prisma.empty : Prisma.sql`AND sp.slug = ${query.plan}`})`;
      conditions.push(query.plan === FREE_PLAN_SLUG ? Prisma.sql`NOT ${live}` : live);
    }
    return Prisma.sql`fu AS (
      SELECT u.id, u."createdAt", p."lastActiveAt", p."onboardingCompletedAt"
      FROM users u LEFT JOIN user_profiles p ON p."userId" = u.id
      WHERE ${Prisma.join(conditions, ' AND ')}
    )`;
  }

  private async activeUsers(fu: Prisma.Sql, from: Date, to: Date): Promise<number> {
    return num(
      await this.prisma.$queryRaw<CountRow[]>`
        WITH ${fu}
        SELECT count(*) AS count FROM fu
        WHERE (fu."lastActiveAt" >= ${from} AND fu."lastActiveAt" < ${to})
           OR EXISTS (SELECT 1 FROM analytics_events e
                      WHERE e."userId" = fu.id AND e."occurredAt" >= ${from} AND e."occurredAt" < ${to})`,
    );
  }

  /** Dn retention: aralıkta kaydolup n. gününde aktif olanların oranı. */
  private async retention(fu: Prisma.Sql, range: Range, day: number, now: Date): Promise<number | null> {
    const cohortEnd = new Date(Math.min(range.to.getTime(), now.getTime() - day * DAY_MS));
    if (cohortEnd <= range.from) return null;
    const rows = await this.prisma.$queryRaw<Array<{ cohort: bigint; retained: bigint }>>`
      WITH ${fu}
      SELECT count(*) AS cohort,
        count(*) FILTER (WHERE
          (fu."lastActiveAt" >= fu."createdAt" + make_interval(days => ${day})
            AND fu."lastActiveAt" < fu."createdAt" + make_interval(days => ${day + 1}))
          OR EXISTS (SELECT 1 FROM analytics_events e WHERE e."userId" = fu.id
            AND e."occurredAt" >= fu."createdAt" + make_interval(days => ${day})
            AND e."occurredAt" < fu."createdAt" + make_interval(days => ${day + 1}))
        ) AS retained
      FROM fu WHERE fu."createdAt" >= ${range.from} AND fu."createdAt" < ${cohortEnd}`;
    const row = rows[0];
    return ratio(Number(row?.retained ?? 0), Number(row?.cohort ?? 0));
  }

  async kpis(query: AnalyticsQuery, now = new Date()): Promise<AnalyticsKpiDto> {
    const range = rangeOf(query, now);
    const fu = this.filteredUsers(query, now);
    const hasUserFilter = Boolean(query.country || query.city || query.status || query.platform || query.plan);
    const day = (offset: number) => new Date(range.to.getTime() - offset * DAY_MS);

    const [dau, wau, mau, d1, d7, d30] = await Promise.all([
      this.activeUsers(fu, day(1), range.to),
      this.activeUsers(fu, day(7), range.to),
      this.activeUsers(fu, day(30), range.to),
      this.retention(fu, range, 1, now),
      this.retention(fu, range, 7, now),
      this.retention(fu, range, 30, now),
    ]);

    const [signups] = await this.prisma.$queryRaw<Array<{ started: bigint; completed: bigint }>>`
      SELECT count(*) FILTER (WHERE name = 'SIGNUP_STARTED') AS started,
             count(*) FILTER (WHERE name = 'SIGNUP_COMPLETED') AS completed
      FROM analytics_events WHERE "occurredAt" >= ${range.from} AND "occurredAt" < ${range.to}`;

    const [users] = await this.prisma.$queryRaw<Array<{ total: bigint; created: bigint; completed: bigint; subscribed: bigint }>>`
      WITH ${fu}
      SELECT count(*) FILTER (WHERE fu."createdAt" < ${range.to}) AS total,
             count(*) FILTER (WHERE fu."createdAt" >= ${range.from} AND fu."createdAt" < ${range.to}) AS created,
             count(*) FILTER (WHERE fu."createdAt" >= ${range.from} AND fu."createdAt" < ${range.to}
                              AND fu."onboardingCompletedAt" IS NOT NULL) AS completed,
             count(*) FILTER (WHERE fu."createdAt" >= ${range.from} AND fu."createdAt" < ${range.to}
                              AND EXISTS (SELECT 1 FROM subscriptions s WHERE s."userId" = fu.id)) AS subscribed
      FROM fu`;

    const [engagement] = await this.prisma.$queryRaw<Array<{ likes: bigint; matches: bigint; conversations: bigint }>>`
      WITH ${fu},
      m AS (
        SELECT m.id FROM matches m
        WHERE m."createdAt" >= ${range.from} AND m."createdAt" < ${range.to}
          AND (m."userAId" IN (SELECT id FROM fu) OR m."userBId" IN (SELECT id FROM fu))
      )
      SELECT
        (SELECT count(*) FROM swipes s WHERE s.action IN ('LIKE', 'SUPER_LIKE')
           AND s."createdAt" >= ${range.from} AND s."createdAt" < ${range.to}
           AND s."actorUserId" IN (SELECT id FROM fu)) AS likes,
        (SELECT count(*) FROM m) AS matches,
        (SELECT count(*) FROM m WHERE EXISTS (
           SELECT 1 FROM conversations c JOIN messages msg ON msg."conversationId" = c.id
           WHERE c."matchId" = m.id)) AS conversations`;

    const [revenue] = await this.prisma.$queryRaw<
      Array<{ revenue: bigint | null; mrr: bigint | null; live: bigint; liveAtStart: bigint; churned: bigint; newPayers: bigint }>
    >`
      WITH ${fu}
      SELECT
        (SELECT sum(pay.amount) FROM payments pay
          WHERE pay.status = 'SUCCEEDED' AND pay."createdAt" >= ${range.from} AND pay."createdAt" < ${range.to}
            AND pay."userId" IN (SELECT id FROM fu)) AS revenue,
        (SELECT sum(CASE WHEN s."interval" = 'MONTHLY' THEN sp."monthlyPrice" ELSE sp."yearlyPrice" / 12 END)
          FROM subscriptions s JOIN subscription_plans sp ON sp.id = s."planId"
          WHERE ((s.status = 'ACTIVE' AND s."currentPeriodEnd" > ${now}) OR (s.status = 'PAST_DUE' AND s."graceUntil" > ${now}))
            AND s."userId" IN (SELECT id FROM fu)) AS mrr,
        (SELECT count(*) FROM subscriptions s
          WHERE ((s.status = 'ACTIVE' AND s."currentPeriodEnd" > ${now}) OR (s.status = 'PAST_DUE' AND s."graceUntil" > ${now}))
            AND s."userId" IN (SELECT id FROM fu)) AS live,
        (SELECT count(*) FROM subscriptions s
          WHERE s."createdAt" < ${range.from} AND (s."endedAt" IS NULL OR s."endedAt" >= ${range.from})
            AND s."userId" IN (SELECT id FROM fu)) AS "liveAtStart",
        (SELECT count(*) FROM subscriptions s
          WHERE s."createdAt" < ${range.from} AND s."endedAt" >= ${range.from} AND s."endedAt" < ${range.to}
            AND s."userId" IN (SELECT id FROM fu)) AS churned,
        (SELECT count(*) FROM (
          SELECT pay."userId" FROM payments pay
          WHERE pay.status IN ('SUCCEEDED', 'REFUNDED') AND pay."userId" IN (SELECT id FROM fu)
          GROUP BY pay."userId"
          HAVING min(pay."createdAt") >= ${range.from} AND min(pay."createdAt") < ${range.to}) first_payers) AS "newPayers"`;

    const eventRows = await this.prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
      WITH ${fu}
      SELECT e.name, count(*) AS count FROM analytics_events e
      WHERE e."occurredAt" >= ${range.from} AND e."occurredAt" < ${range.to}
        ${hasUserFilter ? Prisma.sql`AND e."userId" IN (SELECT id FROM fu)` : Prisma.empty}
      GROUP BY e.name ORDER BY count DESC`;

    const revenueTotal = Number(revenue?.revenue ?? 0);
    const mrr = Number(revenue?.mrr ?? 0);
    const live = Number(revenue?.live ?? 0);
    const churn = ratio(Number(revenue?.churned ?? 0), Number(revenue?.liveAtStart ?? 0));
    const monthlyChurn = churn === null ? null : Math.min(1, (churn * 30) / range.days);
    const arppu = live > 0 ? mrr / live : null;
    const newPayers = Number(revenue?.newPayers ?? 0);

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      dau,
      wau,
      mau,
      signupConversion: ratio(Number(signups?.completed ?? 0), Number(signups?.started ?? 0)),
      profileCompletion: ratio(Number(users?.completed ?? 0), Number(users?.created ?? 0)),
      matchRate: ratio(Number(engagement?.matches ?? 0), Number(engagement?.likes ?? 0)),
      messageRate: ratio(Number(engagement?.conversations ?? 0), Number(engagement?.matches ?? 0)),
      retention: { d1, d7, d30 },
      subscriptionConversion: ratio(Number(users?.subscribed ?? 0), Number(users?.created ?? 0)),
      mrr,
      arpu: Number(users?.total ?? 0) > 0 ? Math.round(revenueTotal / Number(users?.total)) : null,
      churn,
      ltv: arppu !== null && monthlyChurn ? Math.round(arppu / monthlyChurn) : null,
      cac: query.marketingSpend !== undefined && newPayers > 0 ? Math.round(query.marketingSpend / newPayers) : null,
      revenuePerActiveUser: mau > 0 ? Math.round(revenueTotal / mau) : null,
      events: eventRows.map((row) => ({ name: row.name, count: Number(row.count) })),
    };
  }
}
