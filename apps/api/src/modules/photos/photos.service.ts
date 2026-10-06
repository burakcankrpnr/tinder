import { randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { UserPhoto } from '@dating/database';
import type { MessageDto, PhotoDto, PhotoUploadDto } from '@dating/types';
import {
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  MAX_VIDEO_BYTES,
  type PhotoUploadRequestInput,
} from '@dating/validation';
import type { Queue } from 'bullmq';
import { AppException } from '../../common/http/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PHOTO_JOBS, PHOTO_QUEUE, type ProcessPhotoJob } from './photo-queue';
import { isStoredVariants, toPhotoDto } from './photo.mapper';

const STALE_PENDING_UPLOAD_MS = 15 * 60 * 1000;

function receivedFile(file: unknown): { buffer: Buffer; size: number } | null {
  if (!file || typeof file !== 'object') return null;
  const candidate = file as { buffer?: unknown; size?: unknown };
  if (!Buffer.isBuffer(candidate.buffer) || candidate.buffer.length === 0) return null;
  const size = typeof candidate.size === 'number' ? candidate.size : candidate.buffer.length;
  return { buffer: candidate.buffer, size };
}

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue(PHOTO_QUEUE) private readonly queue: Queue<ProcessPhotoJob>,
  ) {}

  private toDto = (photo: UserPhoto): PhotoDto =>
    toPhotoDto(photo, (key) => this.storage.publicUrl(key));

  async list(userId: string): Promise<PhotoDto[]> {
    const photos = await this.prisma.userPhoto.findMany({
      where: { userId, status: { not: 'PENDING_UPLOAD' } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return photos.map(this.toDto);
  }

  async createUpload(userId: string, input: PhotoUploadRequestInput): Promise<PhotoUploadDto> {
    const photoId = randomUUID();
    const uploadKey = `users/${userId}/${photoId}`;

    const photo = await this.prisma.$transaction(async (tx) => {
      // Aynı kullanıcının eşzamanlı istekleri limit kontrolünü atlatamasın.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      await tx.userPhoto.deleteMany({
        where: {
          userId,
          status: 'PENDING_UPLOAD',
          createdAt: { lt: new Date(Date.now() - STALE_PENDING_UPLOAD_MS) },
        },
      });
      const active = await tx.userPhoto.findMany({
        where: { userId, status: { not: 'REJECTED' } },
        select: { position: true },
      });
      if (active.length >= MAX_PHOTOS) {
        throw new AppException(
          'CONFLICT',
          `En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsiniz.`,
          HttpStatus.CONFLICT,
        );
      }
      const position = active.reduce((max, p) => Math.max(max, p.position + 1), 0);
      return tx.userPhoto.create({
        data: { id: photoId, userId, position, uploadKey, contentType: input.contentType },
      });
    });

    const maxBytes = input.contentType.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
    const upload = await this.storage.createUploadPost(uploadKey, input.contentType, maxBytes);
    return { photo: this.toDto(photo), upload };
  }

  /** Telefon depolama portuna erişemez; dosya API üzerinden aynı anahtara yazılır. */
  async storeUpload(userId: string, photoId: string, file: unknown): Promise<MessageDto> {
    const photo = await this.findOwned(userId, photoId);
    if (photo.status !== 'PENDING_UPLOAD') return { message: 'Dosya alındı.' };
    const received = receivedFile(file);
    if (!received) {
      this.logger.warn('Fotoğraf isteği dosyasız geldi');
      throw new AppException('BAD_REQUEST', 'Dosya eksik.', HttpStatus.BAD_REQUEST);
    }
    const byteLimit = photo.contentType.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
    if (received.size > byteLimit) {
      throw new AppException('BAD_REQUEST', 'Bu dosya çok büyük.', HttpStatus.BAD_REQUEST);
    }
    await this.storage.putPrivate(photo.uploadKey, received.buffer, photo.contentType);
    this.logger.log(`Fotoğraf dosyası kaydedildi, boyut ${received.size}`);
    return { message: 'Dosya alındı.' };
  }

  async readPublicMedia(key: string): Promise<{ body: Buffer; contentType: string | null }> {
    if (!key.startsWith('photos/') || key.includes('..')) {
      throw AppException.notFound('Dosya bulunamadı.');
    }
    const object = await this.storage.getMedia(key);
    if (!object) throw AppException.notFound('Dosya bulunamadı.');
    return object;
  }

  private async findOwned(userId: string, photoId: string): Promise<UserPhoto> {
    const photo = await this.prisma.userPhoto.findFirst({ where: { id: photoId, userId } });
    if (!photo) throw AppException.notFound('Fotoğraf bulunamadı.');
    return photo;
  }

  /** İdempotent: aynı fotoğraf için tekrar çağrılırsa mevcut durumu döner, tek job oluşur. */
  async completeUpload(userId: string, photoId: string): Promise<PhotoDto> {
    const photo = await this.findOwned(userId, photoId);
    if (photo.status !== 'PENDING_UPLOAD') return this.toDto(photo);

    const object = await this.storage.headUpload(photo.uploadKey);
    if (!object) {
      throw new AppException('BAD_REQUEST', 'Yüklenen dosya bulunamadı.', HttpStatus.BAD_REQUEST);
    }
    const byteLimit = photo.contentType.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
    if (object.size > byteLimit) {
      await this.storage.deleteUploads([photo.uploadKey]);
      const rejected = await this.prisma.userPhoto.update({
        where: { id: photo.id },
        data: { status: 'REJECTED', rejectReason: 'Bu dosya çok büyük.' },
      });
      return this.toDto(rejected);
    }

    const updated = await this.prisma.userPhoto.updateMany({
      where: { id: photo.id, status: 'PENDING_UPLOAD' },
      data: { status: 'PROCESSING' },
    });
    if (updated.count === 1) {
      await this.queue.add(
        PHOTO_JOBS.process,
        { photoId: photo.id },
        {
          jobId: photo.id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    }
    return this.toDto(await this.findOwned(userId, photoId));
  }

  async reorder(userId: string, ids: string[]): Promise<PhotoDto[]> {
    const photos = await this.prisma.userPhoto.findMany({
      where: { userId, status: { notIn: ['PENDING_UPLOAD', 'REJECTED'] } },
      select: { id: true },
    });
    const owned = new Set(photos.map((photo) => photo.id));
    if (ids.length !== owned.size || !ids.every((id) => owned.has(id))) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Sıralama tüm fotoğraflarını içermeli.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    await this.prisma.$transaction(
      ids.map((id, position) =>
        this.prisma.userPhoto.update({ where: { id }, data: { position } }),
      ),
    );
    return this.list(userId);
  }

  async remove(userId: string, photoId: string): Promise<void> {
    const photo = await this.findOwned(userId, photoId);
    await this.prisma.userPhoto.delete({ where: { id: photo.id } });
    await this.deleteObjects(photo);
  }

  async deleteObjects(photo: Pick<UserPhoto, 'uploadKey' | 'variants'>): Promise<void> {
    await this.storage.deleteUploads([photo.uploadKey]);
    if (isStoredVariants(photo.variants)) {
      await this.storage.deleteMedia(Object.values(photo.variants).map((variant) => variant.key));
    }
  }

  async countUsable(userId: string): Promise<number> {
    return this.prisma.userPhoto.count({
      where: { userId, status: { in: ['PROCESSING', 'APPROVED', 'PENDING_REVIEW'] } },
    });
  }
}
