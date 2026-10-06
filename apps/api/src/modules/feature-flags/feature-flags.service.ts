import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import type { FeatureFlag } from '@dating/database';
import type { FeatureFlagDto } from '@dating/types';
import type { CreateFeatureFlagInput, UpdateFeatureFlagInput } from '@dating/validation';
import { AppException } from '../../common/http/app.exception';
import { isUniqueViolation } from '../../infra/prisma/prisma-errors';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const CACHE_TTL_MS = 30_000;

/** Kullanıcıyı flag'e göre 0-99 arası sabit bir kovaya yerleştirir; rollout artırılınca mevcutlar açık kalır. */
export function rolloutBucket(key: string, userId: string): number {
  return createHash('sha256').update(`${key}:${userId}`).digest().readUInt32BE(0) % 100;
}

export function isFlagEnabledFor(flag: Pick<FeatureFlag, 'key' | 'enabled' | 'rolloutPercent'>, userId: string): boolean {
  if (!flag.enabled) return false;
  if (flag.rolloutPercent >= 100) return true;
  return rolloutBucket(flag.key, userId) < flag.rolloutPercent;
}

function toDto(flag: FeatureFlag): FeatureFlagDto {
  return {
    key: flag.key,
    description: flag.description,
    enabled: flag.enabled,
    rolloutPercent: flag.rolloutPercent,
    updatedAt: flag.updatedAt.toISOString(),
  };
}

/** Spec Bölüm 33: DB'de tutulan, kullanıcı yüzdesine göre kademeli açılabilen feature flag'ler. */
@Injectable()
export class FeatureFlagsService {
  private cache: { flags: FeatureFlag[]; loadedAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async all(): Promise<FeatureFlag[]> {
    if (this.cache && Date.now() - this.cache.loadedAt < CACHE_TTL_MS) return this.cache.flags;
    const flags = await this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
    this.cache = { flags, loadedAt: Date.now() };
    return flags;
  }

  async isEnabled(key: string, userId: string): Promise<boolean> {
    const flag = (await this.all()).find((item) => item.key === key);
    return flag ? isFlagEnabledFor(flag, userId) : false;
  }

  async forUser(userId: string): Promise<Record<string, boolean>> {
    const flags = await this.all();
    return Object.fromEntries(flags.map((flag) => [flag.key, isFlagEnabledFor(flag, userId)]));
  }

  async list(): Promise<FeatureFlagDto[]> {
    const flags = await this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
    return flags.map(toDto);
  }

  async create(actorUserId: string, input: CreateFeatureFlagInput): Promise<FeatureFlagDto> {
    try {
      const flag = await this.prisma.featureFlag.create({ data: { ...input, updatedById: actorUserId } });
      this.cache = null;
      await this.audit.log({
        actorUserId,
        action: 'admin.feature_flag_created',
        targetType: 'feature_flag',
        targetId: flag.key,
        metadata: { enabled: flag.enabled, rolloutPercent: flag.rolloutPercent },
      });
      return toDto(flag);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppException('CONFLICT', 'Bu anahtarla bir flag zaten var.', HttpStatus.CONFLICT);
      }
      throw error;
    }
  }

  async update(actorUserId: string, key: string, input: UpdateFeatureFlagInput): Promise<FeatureFlagDto> {
    const existing = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!existing) throw AppException.notFound('Flag bulunamadı.');
    const flag = await this.prisma.featureFlag.update({ where: { key }, data: { ...input, updatedById: actorUserId } });
    this.cache = null;
    await this.audit.log({
      actorUserId,
      action: 'admin.feature_flag_updated',
      targetType: 'feature_flag',
      targetId: key,
      metadata: {
        before: { enabled: existing.enabled, rolloutPercent: existing.rolloutPercent },
        after: { enabled: flag.enabled, rolloutPercent: flag.rolloutPercent },
      },
    });
    return toDto(flag);
  }
}
