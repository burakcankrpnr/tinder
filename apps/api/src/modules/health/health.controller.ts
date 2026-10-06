import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { HealthDto } from '@dating/types';
import type { Redis } from 'ioredis';
import { Public } from '../../common/auth/decorators';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { REDIS } from '../../infra/redis/redis.module';
import { StorageService } from '../storage/storage.service';

@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  async check(): Promise<HealthDto> {
    const [database, redis, storage] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(
        () => true,
        () => false,
      ),
      this.redis.ping().then(
        (reply) => reply === 'PONG',
        () => false,
      ),
      this.storage.ping(),
    ]);
    return {
      status: database && redis && storage ? 'ok' : 'degraded',
      checks: { database, redis, storage },
    };
  }
}
