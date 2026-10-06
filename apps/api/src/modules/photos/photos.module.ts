import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ModerationProvider, NoopModerationProvider } from './moderation.provider';
import { PHOTO_QUEUE } from './photo-queue';
import { PhotoProcessingService } from './photo-processing.service';
import { PhotoProcessor } from './photo.processor';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';

@Module({
  imports: [BullModule.registerQueue({ name: PHOTO_QUEUE })],
  controllers: [PhotosController],
  providers: [
    PhotosService,
    PhotoProcessingService,
    PhotoProcessor,
    { provide: ModerationProvider, useClass: NoopModerationProvider },
  ],
  exports: [PhotosService],
})
export class PhotosModule {}
