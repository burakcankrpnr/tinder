import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@dating/database';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface AuditEntry {
  actorUserId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonObject;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: entry.actorUserId ?? null,
          action: entry.action,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          ...(entry.metadata ? { metadata: entry.metadata } : {}),
        },
      });
    } catch (error) {
      this.logger.error({ err: error, action: entry.action }, 'Audit log yazılamadı');
    }
  }
}
