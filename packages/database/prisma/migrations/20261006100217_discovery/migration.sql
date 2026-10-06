-- CreateEnum
CREATE TYPE "SwipeAction" AS ENUM ('LIKE', 'PASS', 'SUPER_LIKE');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('ACTIVE', 'UNMATCHED', 'BLOCKED');

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "lastActiveAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "swipes" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "targetUserId" UUID NOT NULL,
    "action" "SwipeAction" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "userAId" UUID NOT NULL,
    "userBId" UUID NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "endedById" UUID,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- Çift başına tek match kaydı ve kendine swipe yasağı
ALTER TABLE "matches" ADD CONSTRAINT "matches_ordered_pair_check" CHECK ("userAId" < "userBId");
ALTER TABLE "swipes" ADD CONSTRAINT "swipes_not_self_check" CHECK ("actorUserId" <> "targetUserId");

-- CreateIndex
CREATE INDEX "swipes_targetUserId_action_idx" ON "swipes"("targetUserId", "action");

-- CreateIndex
CREATE INDEX "swipes_actorUserId_createdAt_idx" ON "swipes"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "swipes_actorUserId_targetUserId_key" ON "swipes"("actorUserId", "targetUserId");

-- CreateIndex
CREATE INDEX "matches_userAId_status_idx" ON "matches"("userAId", "status");

-- CreateIndex
CREATE INDEX "matches_userBId_status_idx" ON "matches"("userBId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "matches_userAId_userBId_key" ON "matches"("userAId", "userBId");

-- CreateIndex
CREATE INDEX "user_profiles_gender_onboardingCompletedAt_idx" ON "user_profiles"("gender", "onboardingCompletedAt");

-- AddForeignKey
ALTER TABLE "swipes" ADD CONSTRAINT "swipes_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swipes" ADD CONSTRAINT "swipes_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
