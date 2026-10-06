import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { REDIS } from '../../infra/redis/redis.module';

const TOUCH_INTERVAL_SECONDS = 5 * 60;

/** Discovery sıralamasındaki aktivite skoru için son aktif zamanı tutar (en fazla 5 dakikada bir yazar). */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async touch(userId: string): Promise<void> {
    try {
      const first = await this.redis.set(`activity:${userId}`, '1', 'EX', TOUCH_INTERVAL_SECONDS, 'NX');
      if (first !== 'OK') return;
      await this.prisma.userProfile.updateMany({ where: { userId }, data: { lastActiveAt: new Date() } });
    } catch (error) {
      this.logger.warn({ err: error }, 'Aktivite zamanı güncellenemedi');
    }
  }
}
