import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { PHOTO_JOBS, PHOTO_QUEUE, type ProcessPhotoJob } from './photo-queue';
import { PhotoProcessingService } from './photo-processing.service';

@Processor(PHOTO_QUEUE, { concurrency: 4 })
export class PhotoProcessor extends WorkerHost implements OnApplicationBootstrap {
  constructor(
    private readonly processing: PhotoProcessingService,
    @InjectQueue(PHOTO_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      PHOTO_JOBS.cleanup,
      { every: 60 * 60 * 1000 },
      { name: PHOTO_JOBS.cleanup, opts: { removeOnComplete: true, removeOnFail: 10 } },
    );
  }

  async process(job: Job<ProcessPhotoJob>): Promise<void> {
    if (job.name === PHOTO_JOBS.cleanup) {
      await this.processing.cleanupStaleUploads();
      return;
    }
    await this.processing.process(job.data.photoId);
  }
}
