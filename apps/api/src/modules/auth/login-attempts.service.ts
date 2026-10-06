import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../../infra/redis/redis.module';

export const MAX_FAILED_LOGINS = 5;
export const LOCK_WINDOW_SECONDS = 15 * 60;

@Injectable()
export class LoginAttemptsService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private key(email: string): string {
    return `auth:login-failures:${email}`;
  }

  async isLocked(email: string): Promise<boolean> {
    const value = await this.redis.get(this.key(email));
    return Number(value ?? 0) >= MAX_FAILED_LOGINS;
  }

  async recordFailure(email: string): Promise<number> {
    const key = this.key(email);
    const [[, count]] = (await this.redis
      .multi()
      .incr(key)
      .expire(key, LOCK_WINDOW_SECONDS, 'NX')
      .exec()) as [[Error | null, number], [Error | null, number]];
    return count;
  }

  async reset(email: string): Promise<void> {
    await this.redis.del(this.key(email));
  }
}
