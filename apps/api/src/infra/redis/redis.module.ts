import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import type { ApiEnv } from '@dating/config';
import { Redis } from 'ioredis';
import { ENV } from '../../config/env.module';

export const REDIS = Symbol('REDIS');

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ENV],
      useFactory: (env: ApiEnv): Redis =>
        new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: false }),
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
