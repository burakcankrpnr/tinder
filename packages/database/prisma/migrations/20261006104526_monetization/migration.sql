-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "EntitlementType" AS ENUM ('SUPER_LIKE', 'BOOST');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CheckoutKind" AS ENUM ('SUBSCRIPTION', 'PRODUCT');

-- CreateEnum
CREATE TYPE "CheckoutStatus" AS ENUM ('OPEN', 'COMPLETED', 'FAILED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('FREE_PLAN', 'SUBSCRIPTION', 'PURCHASE', 'REFUND', 'ADMIN');

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "intentions" "RelationshipIntention"[] DEFAULT ARRAY[]::"RelationshipIntention"[],
ADD COLUMN     "passportCity" TEXT,
ADD COLUMN     "passportLatitude" DOUBLE PRECISION,
ADD COLUMN     "passportLongitude" DOUBLE PRECISION,
ADD COLUMN     "verifiedOnly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "incognito" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPrice" INTEGER NOT NULL,
    "yearlyPrice" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'TRY',
    "features" TEXT[],
    "swipeLimit" INTEGER,
    "superLikeLimit" INTEGER NOT NULL DEFAULT 0,
    "boostLimit" INTEGER NOT NULL DEFAULT 0,
    "rewindEnabled" BOOLEAN NOT NULL DEFAULT false,
    "seeLikesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "incognitoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "passportEnabled" BOOLEAN NOT NULL DEFAULT false,
    "advancedFiltersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "adFree" BOOLEAN NOT NULL DEFAULT false,
    "visibilityBoost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "EntitlementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'TRY',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSubscriptionId" TEXT NOT NULL,
    "providerCustomerId" TEXT,
    "interval" "BillingInterval" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "graceUntil" TIMESTAMP(3),
    "expiringNotifiedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "CheckoutKind" NOT NULL,
    "planId" UUID,
    "productId" UUID,
    "interval" "BillingInterval",
    "provider" TEXT NOT NULL,
    "providerCheckoutId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "CheckoutStatus" NOT NULL DEFAULT 'OPEN',
    "idempotencyKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "subscriptionId" UUID,
    "checkoutSessionId" UUID,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "failureReason" TEXT,
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "EntitlementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "source" "EntitlementSource" NOT NULL,
    "grantKey" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boosts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boosts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_overrides" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "feature" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "reason" TEXT,
    "createdById" UUID,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_slug_key" ON "subscription_plans"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "subscriptions_userId_status_idx" ON "subscriptions"("userId", "status");

-- CreateIndex
CREATE INDEX "subscriptions_status_currentPeriodEnd_idx" ON "subscriptions"("status", "currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_provider_providerSubscriptionId_key" ON "subscriptions"("provider", "providerSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "checkout_sessions_providerCheckoutId_key" ON "checkout_sessions"("providerCheckoutId");

-- CreateIndex
CREATE INDEX "checkout_sessions_userId_createdAt_idx" ON "checkout_sessions"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "checkout_sessions_userId_idempotencyKey_key" ON "checkout_sessions"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "payments_userId_createdAt_idx" ON "payments"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "payments_status_createdAt_idx" ON "payments"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_providerPaymentId_key" ON "payments"("provider", "providerPaymentId");

-- CreateIndex
CREATE INDEX "payment_events_type_createdAt_idx" ON "payment_events"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_provider_providerEventId_key" ON "payment_events"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "entitlements_userId_type_idx" ON "entitlements"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "entitlements_userId_grantKey_key" ON "entitlements"("userId", "grantKey");

-- CreateIndex
CREATE INDEX "boosts_userId_endsAt_idx" ON "boosts"("userId", "endsAt");

-- CreateIndex
CREATE INDEX "boosts_endsAt_idx" ON "boosts"("endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "feature_overrides_userId_feature_key" ON "feature_overrides"("userId", "feature");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_checkoutSessionId_fkey" FOREIGN KEY ("checkoutSessionId") REFERENCES "checkout_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boosts" ADD CONSTRAINT "boosts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_overrides" ADD CONSTRAINT "feature_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Kullanıcı başına tek aktif abonelik
CREATE UNIQUE INDEX "subscriptions_one_active_per_user" ON "subscriptions"("userId") WHERE "status" IN ('ACTIVE', 'PAST_DUE');

-- Sarf edilebilir haklar negatife düşemez
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_quantity_check" CHECK ("quantity" >= 0);

ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_limits_check"
  CHECK ("monthlyPrice" >= 0 AND "yearlyPrice" >= 0 AND ("swipeLimit" IS NULL OR "swipeLimit" >= 0)
    AND "superLikeLimit" >= 0 AND "boostLimit" >= 0 AND "visibilityBoost" BETWEEN 0 AND 1);

ALTER TABLE "products" ADD CONSTRAINT "products_values_check" CHECK ("quantity" > 0 AND "price" >= 0);

ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_target_check"
  CHECK (("kind" = 'SUBSCRIPTION' AND "planId" IS NOT NULL AND "interval" IS NOT NULL)
    OR ("kind" = 'PRODUCT' AND "productId" IS NOT NULL));

-- Varsayılan katalog (admin panelinden yönetilir)
INSERT INTO "subscription_plans" ("id", "slug", "name", "description", "monthlyPrice", "yearlyPrice", "currency", "features",
  "swipeLimit", "superLikeLimit", "boostLimit", "rewindEnabled", "seeLikesEnabled", "incognitoEnabled", "passportEnabled",
  "advancedFiltersEnabled", "adFree", "visibilityBoost", "sortOrder", "updatedAt")
VALUES
  (gen_random_uuid(), 'free', 'Free', 'Tanışmaya başlamak için', 0, 0, 'TRY',
    ARRAY['Günlük 50 Like', 'Temel filtreler', 'Match ve sohbet', 'Profil oluşturma'],
    50, 0, 0, false, false, false, false, false, false, 0, 0, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'plus', 'Plus', 'Daha fazla Like ve kontrol', 14999, 107999, 'TRY',
    ARRAY['Günlük 250 Like', 'Rewind', 'Haftalık 5 Super Like', 'Gelişmiş filtreler', 'Reklamsız deneyim', 'Daha fazla görünürlük'],
    250, 5, 0, true, false, false, false, true, true, 0.1, 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'premium', 'Premium', 'Tüm özellikler', 29999, 215999, 'TRY',
    ARRAY['Sınırsız Like', 'Beğenenleri gör', 'Rewind', 'Haftalık 10 Super Like', 'Aylık 1 Boost', 'Incognito', 'Passport', 'Gelişmiş filtreler', 'Öncelikli görünürlük'],
    NULL, 10, 1, true, true, true, true, true, true, 0.25, 2, CURRENT_TIMESTAMP);

INSERT INTO "products" ("id", "slug", "name", "description", "type", "quantity", "price", "currency", "sortOrder", "updatedAt")
VALUES
  (gen_random_uuid(), 'boost-1', '1 Boost', '30 dakika boyunca öne çık', 'BOOST', 1, 4999, 'TRY', 0, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'boost-5', '5 Boost', '5 kez 30 dakika öne çık', 'BOOST', 5, 19999, 'TRY', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'super-like-5', '5 Super Like', 'Dikkat çekmenin en hızlı yolu', 'SUPER_LIKE', 5, 7999, 'TRY', 2, CURRENT_TIMESTAMP);
