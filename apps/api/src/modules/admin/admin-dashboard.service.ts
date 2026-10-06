import { Injectable } from '@nestjs/common';
import type { AdminDashboardDto } from '@dating/types';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AnalyticsKpiService } from '../analytics/analytics-kpi.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_WINDOW_DAYS = 7;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Spec Bölüm 32 dashboard kartları ve son N günün kayıt/gelir grafikleri. */
@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kpis: AnalyticsKpiService,
  ) {}

  async dashboard(days: number, now = new Date()): Promise<AdminDashboardDto> {
    const since = new Date(now.getTime() - days * DAY_MS);
    const activeSince = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * DAY_MS);

    const [total, active, created, matches, messages, openReports, pendingPhotos, pendingVerifications, revenue, liveSubs, signupRows, revenueRows, kpi] =
      await Promise.all([
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.userProfile.count({ where: { lastActiveAt: { gte: activeSince }, user: { deletedAt: null } } }),
        this.prisma.user.count({ where: { deletedAt: null, createdAt: { gte: since } } }),
        this.prisma.match.count({ where: { createdAt: { gte: since } } }),
        this.prisma.message.count({ where: { createdAt: { gte: since } } }),
        this.prisma.report.count({ where: { status: { in: ['OPEN', 'REVIEWING'] } } }),
        this.prisma.userPhoto.count({ where: { status: 'PENDING_REVIEW' } }),
        this.prisma.verificationRequest.count({ where: { status: 'PENDING' } }),
        this.prisma.payment.aggregate({
          where: { status: 'SUCCEEDED', createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } },
          _sum: { amount: true },
        }),
        this.prisma.subscription.count({
          where: {
            OR: [
              { status: 'ACTIVE', currentPeriodEnd: { gt: now } },
              { status: 'PAST_DUE', graceUntil: { gt: now } },
            ],
          },
        }),
        this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
          SELECT date_trunc('day', "createdAt") AS day, count(*) AS count FROM users
          WHERE "deletedAt" IS NULL AND "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
        this.prisma.$queryRaw<Array<{ day: Date; amount: bigint }>>`
          SELECT date_trunc('day', "createdAt") AS day, sum(amount) AS amount FROM payments
          WHERE status = 'SUCCEEDED' AND "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
        this.kpis.kpis({ from: isoDay(since), to: isoDay(now) }, now),
      ]);

    const signups = new Map(signupRows.map((row) => [isoDay(row.day), Number(row.count)]));
    const income = new Map(revenueRows.map((row) => [isoDay(row.day), Number(row.amount)]));
    const series: string[] = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) series.push(isoDay(new Date(now.getTime() - offset * DAY_MS)));

    return {
      users: { total, active, new: created },
      matches,
      messages,
      openReports,
      pendingModeration: pendingPhotos + pendingVerifications,
      revenue: { last30Days: revenue._sum.amount ?? 0, mrr: kpi.mrr, currency: 'TRY' },
      subscriptions: { active: liveSubs, churnRate: kpi.churn ?? 0 },
      conversionRate: total > 0 ? Math.round((liveSubs / total) * 10_000) / 10_000 : 0,
      signupsByDay: series.map((date) => ({ date, count: signups.get(date) ?? 0 })),
      revenueByDay: series.map((date) => ({ date, amount: income.get(date) ?? 0 })),
    };
  }
}
