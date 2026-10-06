-- CreateEnum
CREATE TYPE "VerificationRequestStatus" AS ENUM ('AWAITING_UPLOAD', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'BANNED';

-- CreateTable
CREATE TABLE "feature_flags" (
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercent" SMALLINT NOT NULL DEFAULT 100,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "userId" UUID,
    "clientId" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'web',
    "properties" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_requests" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "VerificationRequestStatus" NOT NULL DEFAULT 'AWAITING_UPLOAD',
    "gesture" TEXT NOT NULL,
    "selfieKey" TEXT NOT NULL,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_events_name_occurredAt_idx" ON "analytics_events"("name", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_events_userId_occurredAt_idx" ON "analytics_events"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_events_occurredAt_idx" ON "analytics_events"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_events_userId_clientId_key" ON "analytics_events"("userId", "clientId");

-- CreateIndex
CREATE INDEX "verification_requests_status_submittedAt_idx" ON "verification_requests"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "verification_requests_userId_createdAt_idx" ON "verification_requests"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Custom: rollout yüzdesi sınırı
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_rollout_check" CHECK ("rolloutPercent" BETWEEN 0 AND 100);

-- Custom: kullanıcı başına tek açık doğrulama talebi
CREATE UNIQUE INDEX "verification_requests_one_open_per_user"
  ON "verification_requests"("userId") WHERE "status" IN ('AWAITING_UPLOAD', 'PENDING');

-- Custom: spec Bölüm 33 örnek flag'leri (kapalı başlar)
INSERT INTO "feature_flags" ("key", "description", "enabled", "rolloutPercent", "updatedAt") VALUES
  ('NEW_DISCOVERY_ALGORITHM', 'Yeni keşif sıralama algoritması', false, 0, CURRENT_TIMESTAMP),
  ('NEW_PRICING_PAGE', 'Yeni fiyatlandırma sayfası tasarımı', false, 0, CURRENT_TIMESTAMP),
  ('BOOST_V2', 'Boost v2 (daha uzun süre, kademeli görünürlük)', false, 0, CURRENT_TIMESTAMP),
  ('CHAT_V2', 'Yeni sohbet deneyimi', false, 0, CURRENT_TIMESTAMP),
  ('AI_PROFILE_RECOMMENDATION', 'Yapay zekâ destekli profil önerileri', false, 0, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
