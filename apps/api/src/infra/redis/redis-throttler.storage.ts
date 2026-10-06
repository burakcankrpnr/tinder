import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis } from 'ioredis';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

const INCREMENT_SCRIPT = `
local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  local hits = tonumber(redis.call('GET', KEYS[1]) or '0')
  return { hits, math.max(redis.call('PTTL', KEYS[1]), 0), 1, blockTtl }
end
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local hitsTtl = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  return { hits, hitsTtl, 1, tonumber(ARGV[3]) }
end
return { hits, hitsTtl, 0, 0 }
`;

export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'throttle',
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitsKey = `${this.prefix}:${throttlerName}:${key}:hits`;
    const blockKey = `${this.prefix}:${throttlerName}:${key}:block`;
    const effectiveBlock = blockDuration > 0 ? blockDuration : ttl;

    const result = (await this.redis.eval(
      INCREMENT_SCRIPT,
      2,
      hitsKey,
      blockKey,
      ttl,
      limit,
      effectiveBlock,
    )) as [number, number, number, number];

    const [totalHits, hitsTtlMs, blocked, blockTtlMs] = result;
    return {
      totalHits,
      timeToExpire: Math.ceil(hitsTtlMs / 1000),
      isBlocked: blocked === 1,
      timeToBlockExpire: Math.ceil(blockTtlMs / 1000),
    };
  }
}
