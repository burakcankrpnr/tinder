-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('WOMAN', 'MAN', 'NON_BINARY');

-- CreateEnum
CREATE TYPE "RelationshipIntention" AS ENUM ('LONG_TERM', 'LONG_TERM_OPEN_TO_SHORT', 'SHORT_TERM_OPEN_TO_LONG', 'SHORT_TERM', 'FRIENDSHIP', 'NOT_SURE');

-- CreateEnum
CREATE TYPE "LifestyleFrequency" AS ENUM ('NEVER', 'SOMETIMES', 'OFTEN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED');

-- CreateEnum
CREATE TYPE "PhotoStatus" AS ENUM ('PENDING_UPLOAD', 'PROCESSING', 'APPROVED', 'PENDING_REVIEW', 'REJECTED');

-- CreateTable
CREATE TABLE "user_profiles" (
    "userId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "bio" TEXT,
    "city" TEXT,
    "country" CHAR(2),
    "occupation" TEXT,
    "education" TEXT,
    "heightCm" SMALLINT,
    "languages" TEXT[],
    "relationshipIntention" "RelationshipIntention",
    "drinking" "LifestyleFrequency",
    "smoking" "LifestyleFrequency",
    "exercise" "LifestyleFrequency",
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationUpdatedAt" TIMESTAMP(3),
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "userId" UUID NOT NULL,
    "interestedIn" "Gender"[],
    "ageMin" SMALLINT NOT NULL,
    "ageMax" SMALLINT NOT NULL,
    "maxDistanceKm" SMALLINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "interests" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_interests" (
    "userId" UUID NOT NULL,
    "interestId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_interests_pkey" PRIMARY KEY ("userId","interestId")
);

-- CreateTable
CREATE TABLE "user_photos" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "status" "PhotoStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "uploadKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "variants" JSONB,
    "width" INTEGER,
    "height" INTEGER,
    "moderationScore" DOUBLE PRECISION,
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_username_key" ON "user_profiles"("username");

-- CreateIndex
CREATE INDEX "user_profiles_onboardingCompletedAt_idx" ON "user_profiles"("onboardingCompletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "interests_slug_key" ON "interests"("slug");

-- CreateIndex
CREATE INDEX "user_interests_interestId_idx" ON "user_interests"("interestId");

-- CreateIndex
CREATE INDEX "user_photos_userId_position_idx" ON "user_photos"("userId", "position");

-- CreateIndex
CREATE INDEX "user_photos_status_createdAt_idx" ON "user_photos"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "interests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_photos" ADD CONSTRAINT "user_photos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
