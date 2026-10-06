import path from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });

import 'reflect-metadata';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { USER_ROLES } from '@dating/validation';
import { EnvModule } from '../config/env.module';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { PrismaService } from '../infra/prisma/prisma.service';

/**
 * İlk yöneticiyi atamak için: `pnpm user:role <email> ADMIN`.
 * Sonraki rol değişiklikleri admin panelinden (audit log'lu) yapılmalıdır.
 */
@Module({ imports: [EnvModule, PrismaModule] })
class SetRoleModule {}

async function main(): Promise<void> {
  const logger = new Logger('set-role');
  const [email, role] = process.argv.slice(2);
  const parsedRole = USER_ROLES.find((item) => item === role);
  if (!email || !parsedRole) {
    throw new Error(`Kullanım: pnpm user:role <email> <${USER_ROLES.join('|')}>`);
  }

  const app = await NestFactory.createApplicationContext(SetRoleModule, { logger: ['log', 'warn', 'error'] });
  const prisma = app.get(PrismaService);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true, role: true } });
  if (!user) throw new Error('Bu e-postayla kayıtlı kullanıcı yok.');

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { role: parsedRole } }),
    prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.auditLog.create({
      data: {
        action: 'admin.role_changed',
        targetType: 'user',
        targetId: user.id,
        metadata: { from: user.role, to: parsedRole, via: 'cli' },
      },
    }),
  ]);
  logger.log(`Rol güncellendi: ${user.role} → ${parsedRole}. Kullanıcının tekrar giriş yapması gerekiyor.`);
  await app.close();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
