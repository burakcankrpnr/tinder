import { Injectable } from '@nestjs/common';
import type { AuditLog } from '@dating/database';
import type { AuditLogDto, Page } from '@dating/types';
import type { AuditQuery } from '@dating/validation';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { cursorArgs, toPage } from './pagination';

type AuditWithActor = AuditLog & { actor: { id: string; email: string } | null };

/** Audit kayıtlarındaki hassas olabilecek anahtarlar panelde gösterilmez. */
const HIDDEN_METADATA_KEYS = new Set(['ip', 'userAgent', 'token', 'password']);

function sanitizeMetadata(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !HIDDEN_METADATA_KEYS.has(key)));
}

export function toAuditLogDto(log: AuditWithActor): AuditLogDto {
  return {
    id: log.id,
    action: log.action,
    actor: log.actor,
    targetType: log.targetType,
    targetId: log.targetId,
    metadata: sanitizeMetadata(log.metadata),
    createdAt: log.createdAt.toISOString(),
  };
}

export const auditActorInclude = { actor: { select: { id: true, email: true } } } as const;

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AuditQuery): Promise<Page<AuditLogDto>> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        ...(query.action ? { action: { startsWith: query.action } } : {}),
        ...(query.actorId ? { actorUserId: query.actorId } : {}),
        ...(query.targetId ? { targetId: query.targetId } : {}),
      },
      include: auditActorInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...cursorArgs(query.cursor),
    });
    return toPage(logs, query.limit, toAuditLogDto);
  }
}
