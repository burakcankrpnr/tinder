import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../../infra/redis/redis.module';

/** Bağlantı heartbeat'i bu sürede yenilenmezse (ör. instance çöktüyse) kullanıcı offline sayılır. */
export const PRESENCE_TTL_MS = 90_000;
export const PRESENCE_HEARTBEAT_MS = 30_000;

/**
 * Kullanıcı başına sorted set: üye = socket id, skor = bağlantının geçerlilik bitişi.
 * Birden fazla sekme/cihaz ve çoklu API instance'ı doğru sayılır.
 */
@Injectable()
export class PresenceService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private key(userId: string): string {
    return `presence:${userId}`;
  }

  /** Kullanıcı bu bağlantıyla offline → online geçtiyse true döner. */
  async connect(userId: string, socketId: string): Promise<boolean> {
    const now = Date.now();
    const key = this.key(userId);
    const result = await this.redis
      .multi()
      .zremrangebyscore(key, '-inf', now)
      .zcard(key)
      .zadd(key, now + PRESENCE_TTL_MS, socketId)
      .pexpire(key, PRESENCE_TTL_MS)
      .exec();
    const before = result?.[1]?.[1];
    return before === 0;
  }

  async heartbeat(userId: string, socketId: string): Promise<void> {
    const key = this.key(userId);
    await this.redis
      .multi()
      .zadd(key, Date.now() + PRESENCE_TTL_MS, socketId)
      .pexpire(key, PRESENCE_TTL_MS)
      .exec();
  }

  /** Kullanıcının son bağlantısı da kapandıysa true döner. */
  async disconnect(userId: string, socketId: string): Promise<boolean> {
    const key = this.key(userId);
    const result = await this.redis
      .multi()
      .zrem(key, socketId)
      .zremrangebyscore(key, '-inf', Date.now())
      .zcard(key)
      .exec();
    return result?.[2]?.[1] === 0;
  }

  async isOnline(userId: string): Promise<boolean> {
    return (await this.redis.zcount(this.key(userId), Date.now(), '+inf')) > 0;
  }

  async onlineMap(userIds: string[]): Promise<Map<string, boolean>> {
    const map = new Map<string, boolean>();
    if (userIds.length === 0) return map;
    const now = Date.now();
    const pipeline = this.redis.pipeline();
    for (const id of userIds) pipeline.zcount(this.key(id), now, '+inf');
    const results = await pipeline.exec();
    userIds.forEach((id, index) => {
      const count = results?.[index]?.[1];
      map.set(id, typeof count === 'number' && count > 0);
    });
    return map;
  }
}
