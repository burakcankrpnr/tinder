import { randomInt, randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import type { VerificationRequest } from '@dating/database';
import type { AdminVerificationDto, Page, VerificationStateDto, VerificationUploadDto } from '@dating/types';
import { MAX_PHOTO_BYTES, type ModerationDecisionInput, type PhotoUploadRequestInput } from '@dating/validation';
import { AppException } from '../../common/http/app.exception';
import { isUniqueViolation } from '../../infra/prisma/prisma-errors';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { variantUrls } from '../photos/photo.mapper';
import { StorageService } from '../storage/storage.service';

/** Selfie'de istenen hareket; eski bir fotoğrafın yüklenmesini zorlaştırır. */
export const VERIFICATION_GESTURES = [
  'Sağ elinle başparmağını yukarı kaldır',
  'Sol elinle barış işareti yap',
  'Sağ elini çenene koy',
  'İki elinle kalp işareti yap',
  'Sol elinle kulağını tut',
] as const;

const OPEN_STATUSES = ['AWAITING_UPLOAD', 'PENDING'] as const;

/** Spec Bölüm 23: şüpheli/isteğe bağlı hesap doğrulama ve manuel inceleme. */
@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async state(userId: string): Promise<VerificationStateDto> {
    const [profile, request] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { userId }, select: { verificationStatus: true } }),
      this.prisma.verificationRequest.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      status: profile?.verificationStatus ?? 'UNVERIFIED',
      request: request
        ? { id: request.id, status: request.status, gesture: request.gesture, rejectReason: request.rejectReason }
        : null,
    };
  }

  async start(userId: string, input: PhotoUploadRequestInput): Promise<VerificationUploadDto> {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId }, select: { verificationStatus: true } });
    if (!profile) throw new AppException('BAD_REQUEST', 'Önce profilini oluştur.', HttpStatus.BAD_REQUEST);
    if (profile.verificationStatus === 'VERIFIED') {
      throw new AppException('CONFLICT', 'Hesabın zaten doğrulanmış.', HttpStatus.CONFLICT);
    }

    let request = await this.openRequest(userId);
    if (request?.status === 'PENDING') {
      throw new AppException('CONFLICT', 'Doğrulama talebin inceleniyor.', HttpStatus.CONFLICT);
    }
    if (!request) {
      const id = randomUUID();
      try {
        request = await this.prisma.verificationRequest.create({
          data: {
            id,
            userId,
            gesture: VERIFICATION_GESTURES[randomInt(VERIFICATION_GESTURES.length)]!,
            selfieKey: `verifications/${userId}/${id}`,
          },
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        request = await this.openRequest(userId);
        if (!request || request.status !== 'AWAITING_UPLOAD') {
          throw new AppException('CONFLICT', 'Doğrulama talebin inceleniyor.', HttpStatus.CONFLICT);
        }
      }
    }

    const upload = await this.storage.createUploadPost(request.selfieKey, input.contentType, MAX_PHOTO_BYTES);
    return { requestId: request.id, gesture: request.gesture, upload };
  }

  private openRequest(userId: string): Promise<VerificationRequest | null> {
    return this.prisma.verificationRequest.findFirst({
      where: { userId, status: { in: [...OPEN_STATUSES] } },
    });
  }

  async submit(userId: string, requestId: string): Promise<VerificationStateDto> {
    const request = await this.prisma.verificationRequest.findFirst({ where: { id: requestId, userId } });
    if (!request) throw AppException.notFound('Doğrulama talebi bulunamadı.');
    if (request.status !== 'AWAITING_UPLOAD') return this.state(userId);

    const object = await this.storage.headUpload(request.selfieKey);
    if (!object || object.size > MAX_PHOTO_BYTES) {
      throw new AppException('BAD_REQUEST', 'Selfie yüklenemedi, tekrar dene.', HttpStatus.BAD_REQUEST);
    }
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.verificationRequest.updateMany({
        where: { id: request.id, status: 'AWAITING_UPLOAD' },
        data: { status: 'PENDING', submittedAt: new Date() },
      });
      if (updated.count === 1) {
        await tx.userProfile.update({ where: { userId }, data: { verificationStatus: 'PENDING' } });
      }
    });
    await this.audit.log({
      actorUserId: userId,
      action: 'verification.submitted',
      targetType: 'verification_request',
      targetId: request.id,
    });
    return this.state(userId);
  }

  async pending(cursor: string | undefined, limit: number): Promise<Page<AdminVerificationDto>> {
    const requests = await this.prisma.verificationRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: {
          select: {
            profile: { select: { username: true, firstName: true } },
            photos: { where: { status: 'APPROVED' }, orderBy: { position: 'asc' }, take: 3 },
          },
        },
      },
    });
    const page = requests.slice(0, limit);
    const items = await Promise.all(
      page.map(async (request): Promise<AdminVerificationDto> => ({
        id: request.id,
        userId: request.userId,
        username: request.user.profile?.username ?? null,
        firstName: request.user.profile?.firstName ?? null,
        gesture: request.gesture,
        selfieUrl: await this.storage.signedUploadUrl(request.selfieKey, 15 * 60),
        profilePhotos: request.user.photos
          .map((photo) => variantUrls(photo, (key) => this.storage.publicUrl(key)))
          .filter((urls) => urls !== null),
        status: request.status,
        submittedAt: request.submittedAt?.toISOString() ?? null,
      })),
    );
    return { items, nextCursor: requests.length > limit ? (page.at(-1)?.id ?? null) : null };
  }

  /** Yalnızca PENDING talep karara bağlanabilir; eşzamanlı iki moderatör kararı çakışmaz. */
  async review(actorUserId: string, requestId: string, input: ModerationDecisionInput): Promise<void> {
    const approved = input.decision === 'APPROVE';
    const request = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.verificationRequest.updateMany({
        where: { id: requestId, status: 'PENDING' },
        data: {
          status: approved ? 'APPROVED' : 'REJECTED',
          reviewedById: actorUserId,
          reviewedAt: new Date(),
          rejectReason: approved ? null : (input.reason ?? null),
        },
      });
      if (updated.count === 0) return null;
      const reviewed = await tx.verificationRequest.findUniqueOrThrow({ where: { id: requestId } });
      await tx.userProfile.update({
        where: { userId: reviewed.userId },
        data: { verificationStatus: approved ? 'VERIFIED' : 'UNVERIFIED' },
      });
      return reviewed;
    });
    if (!request) throw new AppException('CONFLICT', 'Bu talep zaten karara bağlanmış.', HttpStatus.CONFLICT);

    // Selfie yalnızca inceleme için tutulur.
    await this.storage.deleteUploads([request.selfieKey]).catch(() => undefined);
    await this.audit.log({
      actorUserId,
      action: approved ? 'moderation.verification_approved' : 'moderation.verification_rejected',
      targetType: 'user',
      targetId: request.userId,
      metadata: { requestId, ...(input.reason ? { reason: input.reason } : {}) },
    });
  }
}
