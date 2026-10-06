import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ReportCreatedDto } from '@dating/types';
import type { ReportInput } from '@dating/validation';
import { DomainEvent, type UserReportedEvent } from '../../common/events/domain-events';
import { AppException } from '../../common/http/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { orderedPair } from '../matches/match.mapper';
import { BlocksService } from './blocks.service';

/** Bu pencerede bu kadar farklı kişiden açık şikayet alan hesap otomatik kısıtlanır ve incelemeye düşer. */
export const AUTO_RESTRICT_REPORTERS = 5;
export const REPORT_WINDOW_DAYS = 30;
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: BlocksService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  async create(reporterId: string, input: ReportInput): Promise<ReportCreatedDto> {
    const { reportedUserId } = input;
    if (reporterId === reportedUserId) {
      throw new AppException('BAD_REQUEST', 'Kendini şikayet edemezsin.', HttpStatus.BAD_REQUEST);
    }
    const target = await this.prisma.user.findFirst({
      where: { id: reportedUserId, deletedAt: null },
      select: { id: true },
    });
    if (!target) throw AppException.notFound('Kullanıcı bulunamadı.');
    if (input.messageId) await this.assertReportableMessage(input.messageId, reporterId, reportedUserId);

    const { report, created } = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`report:${reporterId}:${reportedUserId}`}))`;
      const duplicate = await tx.report.findFirst({
        where: {
          reporterId,
          reportedUserId,
          status: { in: ['OPEN', 'REVIEWING'] },
          reason: input.reason,
          messageId: input.messageId ?? null,
          createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
        },
        select: { id: true },
      });
      if (duplicate) return { report: duplicate, created: false };
      const createdReport = await tx.report.create({
        data: {
          reporterId,
          reportedUserId,
          reason: input.reason,
          details: input.details ?? null,
          messageId: input.messageId ?? null,
        },
        select: { id: true },
      });
      return { report: createdReport, created: true };
    });

    if (created) {
      await this.audit.log({
        actorUserId: reporterId,
        action: 'safety.user_reported',
        targetType: 'user',
        targetId: reportedUserId,
        metadata: { reportId: report.id, reason: input.reason },
      });
      const event: UserReportedEvent = {
        reportId: report.id,
        reporterId,
        reportedUserId,
        reason: input.reason,
      };
      this.events.emit(DomainEvent.USER_REPORTED, event);
      await this.applyAutoRestriction(reportedUserId);
    }
    if (input.block) await this.blocks.block(reporterId, reportedUserId);

    return { id: report.id, blocked: input.block };
  }

  /** Şikayet edilen mesaj, iki kullanıcı arasındaki konuşmada ve şikayet edilen kişiye ait olmalı. */
  private async assertReportableMessage(
    messageId: string,
    reporterId: string,
    reportedUserId: string,
  ): Promise<void> {
    const pair = orderedPair(reporterId, reportedUserId);
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        senderId: reportedUserId,
        conversation: { match: { userAId: pair.userAId, userBId: pair.userBId } },
      },
      select: { id: true },
    });
    if (!message) throw AppException.notFound('Mesaj bulunamadı.');
  }

  private async applyAutoRestriction(userId: string): Promise<void> {
    const since = new Date(Date.now() - REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const reporters = await this.prisma.report.groupBy({
      by: ['reporterId'],
      where: { reportedUserId: userId, status: { in: ['OPEN', 'REVIEWING'] }, createdAt: { gte: since } },
    });
    if (reporters.length < AUTO_RESTRICT_REPORTERS) return;

    const updated = await this.prisma.user.updateMany({
      where: { id: userId, status: 'ACTIVE' },
      data: { status: 'RESTRICTED' },
    });
    if (updated.count > 0) {
      this.logger.warn({ userId, reporters: reporters.length }, 'Hesap şikayet eşiği nedeniyle kısıtlandı');
      await this.audit.log({
        action: 'moderation.auto_restricted',
        targetType: 'user',
        targetId: userId,
        metadata: { distinctReporters: reporters.length },
      });
    }
  }
}
