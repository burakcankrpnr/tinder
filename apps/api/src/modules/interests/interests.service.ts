import { Inject, Injectable } from '@nestjs/common';
import type { InterestDto } from '@dating/types';
import type { Redis } from 'ioredis';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { REDIS } from '../../infra/redis/redis.module';

const CACHE_KEY = 'cache:interests:v1';
const CACHE_TTL_SECONDS = 60 * 60;

@Injectable()
export class InterestsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async list(): Promise<InterestDto[]> {
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as InterestDto[];
      if (parsed.length > 0) return parsed;
    }

    const interests = await this.prisma.interest.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, slug: true, name: true, category: true },
    });
    if (interests.length > 0) {
      await this.redis.set(CACHE_KEY, JSON.stringify(interests), 'EX', CACHE_TTL_SECONDS);
    }
    return interests;
  }

  async countExisting(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;
    return this.prisma.interest.count({ where: { id: { in: ids } } });
  }
}
