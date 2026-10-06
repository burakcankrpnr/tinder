import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { BillingLifecycleService } from './billing-lifecycle.service';

export const BILLING_QUEUE = 'billing';
const MAINTENANCE_JOB = 'subscription-maintenance';

@Processor(BILLING_QUEUE, { concurrency: 1 })
export class BillingProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(BillingProcessor.name);

  constructor(
    private readonly lifecycle: BillingLifecycleService,
    @InjectQueue(BILLING_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      MAINTENANCE_JOB,
      { every: 15 * 60 * 1000 },
      { name: MAINTENANCE_JOB, opts: { removeOnComplete: true, removeOnFail: 10 } },
    );
  }

  async process(): Promise<void> {
    const result = await this.lifecycle.runMaintenance();
    if (result.expiring > 0 || result.expired > 0) this.logger.log(result, 'Abonelik bakımı tamamlandı');
  }
}
