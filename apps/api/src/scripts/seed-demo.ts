import path from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });

import 'reflect-metadata';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Gender, Prisma } from '@dating/database';
import sharp from 'sharp';
import { EnvModule } from '../config/env.module';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { PrismaService } from '../infra/prisma/prisma.service';
import { PasswordService } from '../modules/auth/password.service';
import { processImage } from '../modules/photos/image-pipeline';
import type { StoredVariants } from '../modules/photos/photo.mapper';
import { StorageModule } from '../modules/storage/storage.module';
import { StorageService } from '../modules/storage/storage.service';

/**
 * Yalnızca geliştirme ortamı için: İstanbul çevresinde onboarding'i tamamlanmış demo profiller oluşturur.
 * İdempotenttir; mevcut demo kullanıcıları atlanır. Şifre: DEMO_PASSWORD.
 */
const DEMO_PASSWORD = 'demo-password-123';
const DEMO_COUNT = 30;

const WOMEN = ['Elif', 'Zeynep', 'Defne', 'Ece', 'Selin', 'Deniz', 'Melis', 'İrem', 'Naz', 'Ceren', 'Buse', 'Ada', 'Lara', 'Duru', 'Asya'];
const MEN = ['Emre', 'Can', 'Burak', 'Mert', 'Kaan', 'Arda', 'Efe', 'Onur', 'Barış', 'Kerem', 'Ozan', 'Deniz', 'Umut', 'Tolga', 'Alp'];
const BIOS = [
  'Hafta sonları sahil yürüyüşü, hafta içi iyi bir kahve.',
  'Kitap kurdu, amatör fotoğrafçı, kötü espri ustası.',
  'Yeni şehirler keşfetmeyi ve konserleri seviyorum.',
  'Mutfakta deney yapmaktan hoşlanırım; tadımcı aranıyor.',
  'Sabah koşuları ve akşam sinema planları.',
  'Kedi insanı. Podcast önerilerine açığım.',
];
const PALETTE = [
  ['#645387', '#b99bfb'],
  ['#3e354f', '#8e6de8'],
  ['#17151b', '#9c7af2'],
  ['#2b2733', '#d8c8ff'],
];

function placeholderPhoto(name: string, seed: number): Promise<Buffer> {
  const [from, to] = PALETTE[seed % PALETTE.length]!;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
      </linearGradient></defs>
      <rect width="900" height="1200" fill="url(#g)"/>
      <text x="450" y="660" font-family="sans-serif" font-size="320" font-weight="700"
        fill="#ffffff" fill-opacity="0.85" text-anchor="middle">${name.charAt(0)}</text>
    </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

function birthDate(age: number, seed: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - age - 1, (seed * 5) % 12, 1 + (seed % 27)));
}

@Module({
  imports: [EnvModule, PrismaModule, StorageModule],
  providers: [PasswordService],
})
class SeedDemoModule {}

async function main(): Promise<void> {
  const logger = new Logger('seed-demo');
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seed production ortamında çalıştırılamaz.');

  const app = await NestFactory.createApplicationContext(SeedDemoModule, { logger: ['log', 'warn', 'error'] });
  await app.init();
  const prisma = app.get(PrismaService);
  const storage = app.get(StorageService);
  const passwordHash = await app.get(PasswordService).hash(DEMO_PASSWORD);
  const interests = await prisma.interest.findMany({ select: { id: true } });

  let created = 0;
  for (let index = 0; index < DEMO_COUNT; index += 1) {
    const email = `demo${index + 1}@dating.local`;
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) continue;

    const gender: Gender = index % 2 === 0 ? 'WOMAN' : 'MAN';
    const names = gender === 'WOMAN' ? WOMEN : MEN;
    const firstName = names[Math.floor(index / 2) % names.length]!;
    const age = 21 + ((index * 7) % 20);
    const interestIds = interests
      .filter((_, interestIndex) => (interestIndex + index) % 6 === 0)
      .slice(0, 6)
      .map((interest) => interest.id);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        emailVerifiedAt: new Date(),
        birthDate: birthDate(age, index),
        profile: {
          create: {
            firstName,
            username: `demo_${index + 1}`,
            gender,
            bio: BIOS[index % BIOS.length]!,
            city: 'İstanbul',
            country: 'TR',
            occupation: ['Tasarımcı', 'Mühendis', 'Öğretmen', 'Doktor', 'Avukat'][index % 5]!,
            languages: index % 3 === 0 ? ['tr', 'en'] : ['tr'],
            relationshipIntention: (['LONG_TERM', 'SHORT_TERM_OPEN_TO_LONG', 'NOT_SURE'] as const)[index % 3]!,
            latitude: Math.round((41.0 + ((index * 13) % 20) / 100) * 100) / 100,
            longitude: Math.round((28.85 + ((index * 17) % 30) / 100) * 100) / 100,
            locationUpdatedAt: new Date(),
            onboardingCompletedAt: new Date(),
            lastActiveAt: new Date(Date.now() - (index % 10) * 12 * 60 * 60 * 1000),
          },
        },
        preferences: {
          create: {
            interestedIn: index % 5 === 0 ? ['WOMAN', 'MAN'] : [gender === 'WOMAN' ? 'MAN' : 'WOMAN'],
            ageMin: 18,
            ageMax: 50,
            maxDistanceKm: 100,
          },
        },
        interests: { create: interestIds.map((interestId) => ({ interestId })) },
      },
    });

    const photoCount = 1 + (index % 3);
    for (let position = 0; position < photoCount; position += 1) {
      const processed = await processImage(await placeholderPhoto(firstName, index + position));
      const photo = await prisma.userPhoto.create({
        data: {
          userId: user.id,
          position,
          status: 'PROCESSING',
          uploadKey: `users/${user.id}/demo-${position}`,
          contentType: 'image/jpeg',
        },
      });
      const variants = {} as StoredVariants;
      for (const variant of processed.variants) {
        const key = `photos/${user.id}/${photo.id}/${variant.name}.webp`;
        await storage.putMedia(key, variant.buffer, 'image/webp');
        variants[variant.name] = { key, width: variant.width, height: variant.height };
      }
      await prisma.userPhoto.update({
        where: { id: photo.id },
        data: {
          status: 'APPROVED',
          width: processed.width,
          height: processed.height,
          moderationScore: 0,
          variants: variants as unknown as Prisma.InputJsonObject,
        },
      });
    }
    created += 1;
  }

  logger.log(`${created} demo kullanıcı oluşturuldu (toplam ${DEMO_COUNT}). Şifre: ${DEMO_PASSWORD}`);
  await app.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
