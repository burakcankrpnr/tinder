import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@dating/database';
import type { AdminReportDto, ModerationPhotoDto, Page } from '@dating/types';
import type { AdminReportsQuery, ModerationDecisionInput, ResolveReportInput } from '@dating/validation';
import type { AuthUser } from '../../common/auth/auth-user';
import { DomainEvent, type UserReportedEvent } from '../../common/events/domain-events';
import { AppException } from '../../common/http/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { variantUrls } from '../photos/photo.mapper';
import { PhotosService } from '../photos/photos.service';
import { StorageService } from '../storage/storage.service';
import { AdminUsersService } from './admin-users.service';
import { cursorArgs, toPage } from './pagination';

const reportInclude = {
  reporter: { select: { id: true, profile: { select: { firstName: true, username: true } } } },
  reportedUser: {
    select: {
      id: true,
      status: true,
      profile: { select: { firstName: true, username: true } },
      _count: { select: { reportsReceived: true } },
    },
  },
  resolvedBy: { select: { email: true } },
  message: { select: { id: true, type: true, body: true, createdAt: true } },
} satisfies Prisma.ReportInclude;

type ReportWithRelations = Prisma.ReportGetPayload<{ include: typeof reportInclude }>;

function toReportDto(report: ReportWithRelations): AdminReportDto {
  return {
    id: report.id,
    reason: report.reason,
    details: report.details,
    status: report.status,
    resolution: report.resolution,
    createdAt: report.createdAt.toISOString(),
    resolvedAt: report.resolvedAt?.toISOString() ?? null,
    resolvedBy: report.resolvedBy?.email ?? null,
    reporter: {
      id: report.reporter.id,
      firstName: report.reporter.profile?.firstName ?? null,
      username: report.reporter.profile?.username ?? null,
    },
    reportedUser: {
      id: report.reportedUser.id,
      firstName: report.reportedUser.profile?.firstName ?? null,
      username: report.reportedUser.profile?.username ?? null,
      status: report.reportedUser.status,
      totalReports: report.reportedUser._count.reportsReceived,
    },
    message: report.message
      ? {
          id: report.message.id,
          type: report.message.type,
          body: report.message.body,
          createdAt: report.message.createdAt.toISOString(),
        }
      : null,
  };
}

const ALLOWED_FROM: Record<ResolveReportInput['status'], Array<'OPEN' | 'REVIEWING'>> = {
  REVIEWING: ['OPEN'],
  RESOLVED: ['OPEN', 'REVIEWING'],
  DISMISSED: ['OPEN', 'REVIEWING'],
};

/**
 * Spec Bölüm 20 "ModerationService" + Bölüm 22 moderation pipeline'ının manuel inceleme adımı:
 * report kuyruğu, PENDING_REVIEW fotoğraflar ve otomatik güvenlik kuralları.
 */
@Injectable()
export class AdminModerationService {
  private readonly logger = new Logger(AdminModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly users: AdminUsersService,
    private readonly photos: PhotosService,
    private readonly storage: StorageService,
  ) {}

  async reports(query: AdminReportsQuery): Promise<Page<AdminReportDto>> {
    const reports = await this.prisma.report.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.reason ? { reason: query.reason } : {}),
        ...(query.userId ? { reportedUserId: query.userId } : {}),
      },
      include: reportInclude,
      orderBy: [{ createdAt: query.status === 'RESOLVED' || query.status === 'DISMISSED' ? 'desc' : 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...cursorArgs(query.cursor),
    });
    return toPage(reports, query.limit, toReportDto);
  }

  async report(reportId: string): Promise<AdminReportDto> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId }, include: reportInclude });
    if (!report) throw AppException.notFound('Şikayet bulunamadı.');
    return toReportDto(report);
  }

  /** Durum geçişi koşullu güncellemeyle yapılır; iki moderatör aynı raporu iki kez kapatamaz. */
  async resolve(actor: AuthUser, reportId: string, input: ResolveReportInput): Promise<AdminReportDto> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, reportedUserId: true, status: true },
    });
    if (!report) throw AppException.notFound('Şikayet bulunamadı.');
    if (input.action !== 'NONE' && input.status !== 'RESOLVED') {
      throw new AppException('BAD_REQUEST', 'Yaptırım yalnızca çözümlenen şikayette uygulanabilir.', HttpStatus.BAD_REQUEST);
    }

    const closing = input.status !== 'REVIEWING';
    const updated = await this.prisma.report.updateMany({
      where: { id: reportId, status: { in: ALLOWED_FROM[input.status] } },
      data: {
        status: input.status,
        ...(input.resolution !== undefined ? { resolution: input.resolution } : {}),
        ...(closing ? { resolvedById: actor.id, resolvedAt: new Date() } : {}),
      },
    });
    if (updated.count === 0) {
      throw new AppException('CONFLICT', 'Bu şikayet zaten işlenmiş.', HttpStatus.CONFLICT);
    }

    if (input.action !== 'NONE') {
      await this.users.moderate(
        actor,
        report.reportedUserId,
        input.action === 'BAN' ? 'BANNED' : 'RESTRICTED',
        input.resolution ?? `Şikayet ${reportId} sonucu`,
        { escalateOnly: true },
      );
    }
    await this.audit.log({
      actorUserId: actor.id,
      action: `moderation.report_${input.status.toLowerCase()}`,
      targetType: 'report',
      targetId: reportId,
      metadata: { from: report.status, action: input.action, reportedUserId: report.reportedUserId },
    });
    return this.report(reportId);
  }

  async pendingPhotos(cursor: string | undefined, limit: number): Promise<Page<ModerationPhotoDto>> {
    const photos = await this.prisma.userPhoto.findMany({
      where: { status: 'PENDING_REVIEW' },
      include: { user: { select: { profile: { select: { username: true } } } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...cursorArgs(cursor),
    });
    return toPage(photos, limit, (photo) => ({
      id: photo.id,
      userId: photo.userId,
      username: photo.user.profile?.username ?? null,
      urls: variantUrls(photo, (key) => this.storage.publicUrl(key)),
      moderationScore: photo.moderationScore,
      createdAt: photo.createdAt.toISOString(),
    }));
  }

  async decidePhoto(actor: AuthUser, photoId: string, input: ModerationDecisionInput): Promise<void> {
    const approved = input.decision === 'APPROVE';
    const updated = await this.prisma.userPhoto.updateMany({
      where: { id: photoId, status: 'PENDING_REVIEW' },
      data: approved
        ? { status: 'APPROVED', rejectReason: null }
        : { status: 'REJECTED', rejectReason: input.reason ?? 'Fotoğraf topluluk kurallarına uymuyor.' },
    });
    if (updated.count === 0) {
      throw new AppException('CONFLICT', 'Bu fotoğraf zaten incelenmiş.', HttpStatus.CONFLICT);
    }
    const photo = await this.prisma.userPhoto.findUniqueOrThrow({ where: { id: photoId } });
    if (!approved) {
      await this.photos.deleteObjects(photo).catch((error: unknown) => {
        this.logger.warn({ err: error, photoId }, 'Reddedilen fotoğrafın dosyaları silinemedi');
      });
      await this.prisma.userPhoto.update({ where: { id: photoId }, data: { variants: Prisma.DbNull } });
    }
    await this.audit.log({
      actorUserId: actor.id,
      action: approved ? 'moderation.photo_approved' : 'moderation.photo_rejected',
      targetType: 'photo',
      targetId: photoId,
      metadata: { userId: photo.userId, ...(input.reason ? { reason: input.reason } : {}) },
    });
  }

  /**
   * Yaş güvenliği (spec Bölüm 23): reşit olmadığı bildirilen hesap, moderatör inceleyene kadar
   * keşiften ve sohbetten çıkarılır (RESTRICTED). Karar yine insan moderatördedir.
   */
  @OnEvent(DomainEvent.USER_REPORTED, { async: true, promisify: true })
  async onUserReported(event: UserReportedEvent): Promise<void> {
    if (event.reason !== 'UNDERAGE') return;
    try {
      const target = await this.prisma.user.findUnique({
        where: { id: event.reportedUserId },
        select: { status: true, role: true },
      });
      if (!target || target.status !== 'ACTIVE' || target.role !== 'USER') return;
      await this.users.applyStatus(null, event.reportedUserId, 'ACTIVE', 'RESTRICTED', `UNDERAGE şikayeti (${event.reportId})`);
    } catch (error) {
      this.logger.warn({ err: error, reportId: event.reportId }, 'UNDERAGE şikayeti için otomatik kısıtlama uygulanamadı');
    }
  }
}
