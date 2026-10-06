import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@dating/database';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { InvalidImageError, processImage } from './image-pipeline';
import { ModerationProvider, decideModeration } from './moderation.provider';
import type { StoredVariants } from './photo.mapper';

const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PhotoProcessingService {
  private readonly logger = new Logger(PhotoProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly moderation: ModerationProvider,
    private readonly audit: AuditService,
  ) {}

  async process(photoId: string): Promise<void> {
    const photo = await this.prisma.userPhoto.findUnique({ where: { id: photoId } });
    if (!photo || photo.status !== 'PROCESSING') return;

    const original = await this.storage.getUpload(photo.uploadKey);

    if (photo.contentType.startsWith('video/')) {
      const key = `photos/${photo.userId}/${photo.id}/loop.mp4`;
      await this.storage.putMedia(key, original, photo.contentType);
      const file = { key, width: photo.width ?? 0, height: photo.height ?? 0 };
      await this.prisma.userPhoto.update({
        where: { id: photo.id },
        data: {
          status: 'APPROVED',
          variants: { thumb: file, medium: file, large: file },
        },
      });
      await this.storage.deleteUploads([photo.uploadKey]);
      return;
    }

    let processed;
    try {
      processed = await processImage(original);
    } catch (error) {
      if (!(error instanceof InvalidImageError)) throw error;
      await this.prisma.userPhoto.update({
        where: { id: photo.id },
        data: { status: 'REJECTED', rejectReason: error.message },
      });
      await this.storage.deleteUploads([photo.uploadKey]);
      return;
    }

    const large = processed.variants.find((variant) => variant.name === 'large');
    const moderation = await this.moderation.assess(large?.buffer ?? original);
    const decision = decideModeration(moderation.score);

    const variants = {} as StoredVariants;
    if (decision !== 'REJECTED') {
      for (const variant of processed.variants) {
        const key = `photos/${photo.userId}/${photo.id}/${variant.name}.webp`;
        await this.storage.putMedia(key, variant.buffer, 'image/webp');
        variants[variant.name] = { key, width: variant.width, height: variant.height };
      }
    }

    await this.prisma.userPhoto.update({
      where: { id: photo.id },
      data: {
        status: decision,
        width: processed.width,
        height: processed.height,
        moderationScore: moderation.score,
        rejectReason: decision === 'REJECTED' ? 'Fotoğraf topluluk kurallarına uymuyor.' : null,
        ...(decision !== 'REJECTED'
          ? { variants: variants as unknown as Prisma.InputJsonObject }
          : {}),
      },
    });
    await this.storage.deleteUploads([photo.uploadKey]);

    if (decision !== 'APPROVED') {
      await this.audit.log({
        actorUserId: photo.userId,
        action: `photo.moderation_${decision.toLowerCase()}`,
        targetType: 'photo',
        targetId: photo.id,
        metadata: { labels: moderation.labels },
      });
    }
  }

  async cleanupStaleUploads(): Promise<number> {
    const stale = await this.prisma.userPhoto.findMany({
      where: { status: 'PENDING_UPLOAD', createdAt: { lt: new Date(Date.now() - STALE_UPLOAD_MS) } },
      select: { id: true, uploadKey: true },
      take: 500,
    });
    if (stale.length === 0) return 0;
    await this.storage.deleteUploads(stale.map((photo) => photo.uploadKey));
    await this.prisma.userPhoto.deleteMany({ where: { id: { in: stale.map((photo) => photo.id) } } });
    this.logger.log(`${stale.length} yarım kalmış yükleme temizlendi`);
    return stale.length;
  }
}
