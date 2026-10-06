import { randomUUID } from 'node:crypto';
import type {
  BoostDto,
  CatalogDto,
  CheckoutDto,
  DiscoveryFeedDto,
  EntitlementsDto,
  LikesReceivedDto,
  MockCheckoutDto,
  NotificationPageDto,
  PaymentDto,
  RewindResultDto,
} from '@dating/types';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BillingLifecycleService } from '../src/modules/billing/billing-lifecycle.service';
import { signPayload } from '../src/modules/billing/webhook-signature';
import { type TestContext, createTestApp } from './create-test-app';
import { type TestUser, createTestUser } from './factories';
import { TEST_WEBHOOK_SECRET } from './test-env';

async function eventually<T>(probe: () => Promise<T | undefined | null | false>, timeoutMs = 3000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('Condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

describe('Monetization: plans, payments, entitlements (e2e)', () => {
  let ctx: TestContext;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    ctx = await createTestApp();
    http = request(ctx.app.getHttpServer());
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  const woman = (overrides: Parameters<typeof createTestUser>[1] = {}) =>
    createTestUser(ctx, { name: 'Ayse', gender: 'WOMAN', interestedIn: ['MAN'], ...overrides });
  const man = (overrides: Parameters<typeof createTestUser>[1] = {}) =>
    createTestUser(ctx, { name: 'Mehmet', gender: 'MAN', interestedIn: ['WOMAN'], ...overrides });

  const auth = (user: TestUser) => `Bearer ${user.token}`;

  const entitlements = async (user: TestUser): Promise<EntitlementsDto> =>
    (await http.get('/api/v1/billing/entitlements').set('Authorization', auth(user)).expect(200)).body.data;

  const swipe = (user: TestUser, targetUserId: string, action: string) =>
    http.post('/api/v1/swipes').set('Authorization', auth(user)).send({ targetUserId, action });

  const startCheckout = (user: TestUser, body: object, key: string = randomUUID()) =>
    http.post('/api/v1/payments/checkout').set('Authorization', auth(user)).set('Idempotency-Key', key).send(body);

  const checkoutId = (checkout: CheckoutDto) => checkout.url.split('/').pop() ?? '';

  async function buy(user: TestUser, body: object, outcome = 'success'): Promise<MockCheckoutDto> {
    const checkout: CheckoutDto = (await startCheckout(user, body).expect(201)).body.data;
    const completed = await http
      .post(`/api/v1/payments/mock/checkouts/${checkoutId(checkout)}/complete`)
      .set('Authorization', auth(user))
      .send({ outcome })
      .expect(200);
    return completed.body.data;
  }

  const subscribe = (user: TestUser, planSlug = 'premium', interval = 'MONTHLY') =>
    buy(user, { kind: 'SUBSCRIPTION', planSlug, interval });

  const simulate = (user: TestUser, event: string) =>
    http.post('/api/v1/payments/mock/subscription/simulate').set('Authorization', auth(user)).send({ event });

  function sendWebhook(payload: object, signature?: string) {
    const body = JSON.stringify(payload);
    return http
      .post('/api/v1/payments/webhooks/mock')
      .set('Content-Type', 'application/json')
      .set('x-mock-signature', signature ?? signPayload(TEST_WEBHOOK_SECRET, body))
      .send(body);
  }

  it('serves plans and products from the database with yearly savings', async () => {
    const response = await http.get('/api/v1/billing/plans').expect(200);
    const catalog: CatalogDto = response.body.data;
    expect(catalog.plans.map((plan) => plan.slug)).toEqual(['free', 'plus', 'premium']);
    const premium = catalog.plans.find((plan) => plan.slug === 'premium');
    expect(premium?.limits.dailyLikes).toBeNull();
    expect(premium?.perks.seeLikes).toBe(true);
    expect(premium?.yearlySavingsPercent).toBeGreaterThan(0);
    expect(catalog.products.map((product) => product.slug)).toContain('boost-1');
  });

  it('enforces the daily like limit and reports remaining likes', async () => {
    const ayse = await woman();
    const targets = await Promise.all([man(), man(), man()]);
    await ctx.prisma.featureOverride.create({ data: { userId: ayse.id, feature: 'dailyLikeLimit', value: 2 } });

    expect((await entitlements(ayse)).likes).toMatchObject({ limit: 2, remaining: 2, allowed: true });
    await swipe(ayse, targets[0]!.id, 'LIKE').expect(200);
    await swipe(ayse, targets[0]!.id, 'LIKE').expect(200);
    await swipe(ayse, targets[1]!.id, 'LIKE').expect(200);
    const blocked = await swipe(ayse, targets[2]!.id, 'LIKE').expect(402);
    expect(blocked.body.error.code).toBe('LIMIT_REACHED');
    await swipe(ayse, targets[2]!.id, 'PASS').expect(200);

    const likes = (await entitlements(ayse)).likes;
    expect(likes).toMatchObject({ remaining: 0, allowed: false });
    expect(new Date(likes.resetAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('requires an Idempotency-Key and replays checkout for the same key', async () => {
    const ayse = await woman();
    await http
      .post('/api/v1/payments/checkout')
      .set('Authorization', auth(ayse))
      .send({ kind: 'SUBSCRIPTION', planSlug: 'premium', interval: 'MONTHLY' })
      .expect(422);

    const key = randomUUID();
    const body = { kind: 'SUBSCRIPTION', planSlug: 'premium', interval: 'MONTHLY' };
    const first: CheckoutDto = (await startCheckout(ayse, body, key).expect(201)).body.data;
    const again: CheckoutDto = (await startCheckout(ayse, body, key).expect(201)).body.data;
    expect(again).toEqual(first);
    await startCheckout(ayse, { ...body, interval: 'YEARLY' }, key).expect(422);
    await startCheckout(ayse, { kind: 'SUBSCRIPTION', planSlug: 'free', interval: 'MONTHLY' }).expect(404);
    expect(await ctx.prisma.checkoutSession.count({ where: { userId: ayse.id } })).toBe(1);

    const other = await man();
    await http
      .get(`/api/v1/payments/mock/checkouts/${checkoutId(first)}`)
      .set('Authorization', auth(other))
      .expect(404);
  });

  it('activates a subscription only through the verified webhook and ignores duplicates', async () => {
    const ayse = await woman();
    const checkout: CheckoutDto = (
      await startCheckout(ayse, { kind: 'SUBSCRIPTION', planSlug: 'premium', interval: 'YEARLY' }).expect(201)
    ).body.data;
    expect((await entitlements(ayse)).plan.slug).toBe('free');

    const periodStart = new Date();
    const event = {
      id: `evt_${randomUUID()}`,
      type: 'checkout.completed',
      data: {
        checkoutId: checkoutId(checkout),
        paymentId: `pay_${randomUUID()}`,
        customerId: 'cus_1',
        amount: 215999,
        currency: 'TRY',
        subscription: {
          id: `sub_${randomUUID()}`,
          periodStart: periodStart.toISOString(),
          periodEnd: new Date(periodStart.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
    };

    const forged = await sendWebhook(event, signPayload('wrong-secret-wrong-secret-wrong-secret', JSON.stringify(event)));
    expect(forged.status).toBe(400);
    expect(forged.body.error.code).toBe('INVALID_SIGNATURE');
    expect((await entitlements(ayse)).plan.slug).toBe('free');

    const results = await Promise.all([sendWebhook(event), sendWebhook(event), sendWebhook(event)]);
    expect(results.map((result) => result.status)).toEqual([200, 200, 200]);
    expect(results.filter((result) => result.body.data.duplicate === false)).toHaveLength(1);
    expect(await ctx.prisma.subscription.count({ where: { userId: ayse.id } })).toBe(1);
    expect(await ctx.prisma.payment.count({ where: { userId: ayse.id } })).toBe(1);

    const summary = await entitlements(ayse);
    expect(summary.plan.slug).toBe('premium');
    expect(summary.subscription).toMatchObject({ state: 'ACTIVE', interval: 'YEARLY' });
    expect(summary.likes.limit).toBeNull();
    expect(summary.features.seeLikes).toBe(true);
    expect(summary.boosts.remaining).toBe(1);
    expect(summary.superLikes.remaining).toBe(10);

    await startCheckout(ayse, { kind: 'SUBSCRIPTION', planSlug: 'plus', interval: 'MONTHLY' }).expect(409);
  });

  it('follows the subscription lifecycle: cancel, payment failure, grace period, renewal, expiry', async () => {
    const ayse = await woman();
    const completed = await subscribe(ayse, 'plus');
    expect(completed.status).toBe('COMPLETED');

    const payments: PaymentDto[] = (await http.get('/api/v1/payments').set('Authorization', auth(ayse)).expect(200))
      .body.data;
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ status: 'SUCCEEDED', amount: 14999, description: 'Plus (aylık)' });

    const failed: EntitlementsDto = (await simulate(ayse, 'payment_failed').expect(200)).body.data;
    expect(failed.subscription?.state).toBe('GRACE_PERIOD');
    expect(failed.plan.slug).toBe('plus');

    const renewed: EntitlementsDto = (await simulate(ayse, 'renew').expect(200)).body.data;
    expect(renewed.subscription?.state).toBe('ACTIVE');

    const canceled: EntitlementsDto = (
      await http.post('/api/v1/billing/subscription/cancel').set('Authorization', auth(ayse)).expect(200)
    ).body.data;
    expect(canceled.subscription?.state).toBe('CANCEL_AT_PERIOD_END');
    expect(canceled.plan.slug).toBe('plus');

    const notifications = await eventually(async () => {
      const page: NotificationPageDto = (
        await http.get('/api/v1/notifications').set('Authorization', auth(ayse)).expect(200)
      ).body.data;
      const types = page.notifications.map((item) => item.type);
      return types.includes('PAYMENT_FAILED') && types.includes('SUBSCRIPTION_RENEWED') ? page : null;
    });
    expect(notifications.notifications.find((item) => item.type === 'PAYMENT_FAILED')?.href).toBe('/subscription');

    const subscription = await ctx.prisma.subscription.findFirstOrThrow({ where: { userId: ayse.id } });
    const lifecycle = ctx.app.get(BillingLifecycleService);
    const nearEnd = new Date(subscription.currentPeriodEnd.getTime() - 24 * 60 * 60 * 1000);
    expect(await lifecycle.runMaintenance(nearEnd)).toEqual({ expiring: 1, expired: 0 });
    expect(await lifecycle.runMaintenance(nearEnd)).toEqual({ expiring: 0, expired: 0 });
    await eventually(async () =>
      ctx.prisma.notification.findFirst({ where: { userId: ayse.id, type: 'SUBSCRIPTION_EXPIRING' } }),
    );

    const afterEnd = new Date(subscription.currentPeriodEnd.getTime() + 60 * 1000);
    expect((await lifecycle.runMaintenance(afterEnd)).expired).toBe(1);
    const expired = await ctx.prisma.subscription.findFirstOrThrow({ where: { userId: ayse.id } });
    expect(expired.status).toBe('EXPIRED');
    expect((await entitlements(ayse)).plan.slug).toBe('free');
  });

  it('refunds a second payment instead of creating a second subscription', async () => {
    const ayse = await woman();
    const body = { kind: 'SUBSCRIPTION', planSlug: 'premium', interval: 'MONTHLY' };
    const first: CheckoutDto = (await startCheckout(ayse, body).expect(201)).body.data;
    const second: CheckoutDto = (await startCheckout(ayse, body).expect(201)).body.data;
    for (const checkout of [first, second]) {
      await http
        .post(`/api/v1/payments/mock/checkouts/${checkoutId(checkout)}/complete`)
        .set('Authorization', auth(ayse))
        .send({ outcome: 'success' })
        .expect(200);
    }
    expect(await ctx.prisma.subscription.count({ where: { userId: ayse.id } })).toBe(1);
    await eventually(async () => (await ctx.prisma.payment.count({ where: { userId: ayse.id, status: 'REFUNDED' } })) === 1);
  });

  it('records failed checkouts without granting anything', async () => {
    const ayse = await woman();
    const result = await buy(ayse, { kind: 'PRODUCT', productSlug: 'boost-1' }, 'fail');
    expect(result.status).toBe('FAILED');
    expect((await entitlements(ayse)).boosts.remaining).toBe(0);
    const payments: PaymentDto[] = (await http.get('/api/v1/payments').set('Authorization', auth(ayse)).expect(200))
      .body.data;
    expect(payments[0]?.status).toBe('FAILED');
  });

  it('consumes Super Likes atomically, even under concurrent requests', async () => {
    const ayse = await woman();
    const [first, second] = await Promise.all([man(), man()]);
    expect((await swipe(ayse, first.id, 'SUPER_LIKE').expect(402)).body.error.code).toBe('LIMIT_REACHED');

    await ctx.prisma.entitlement.create({
      data: { userId: ayse.id, type: 'SUPER_LIKE', quantity: 1, source: 'ADMIN' },
    });
    const results = await Promise.all([swipe(ayse, first.id, 'SUPER_LIKE'), swipe(ayse, second.id, 'SUPER_LIKE')]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 402]);
    expect((await entitlements(ayse)).superLikes.remaining).toBe(0);
    expect(await ctx.prisma.swipe.count({ where: { actorUserId: ayse.id, action: 'SUPER_LIKE' } })).toBe(1);

    await buy(ayse, { kind: 'PRODUCT', productSlug: 'super-like-5' });
    expect((await entitlements(ayse)).superLikes.remaining).toBe(5);

    const superLiked = results[0]?.status === 200 ? first : second;
    const feed: DiscoveryFeedDto = (
      await http.get('/api/v1/discovery').set('Authorization', auth(superLiked)).expect(200)
    ).body.data;
    expect(feed.cards[0]).toMatchObject({ id: ayse.id, superLikedYou: true });
  });

  it('rewinds the last swipe for Plus users and refuses matched swipes', async () => {
    const ayse = await woman();
    const [mehmet, ali] = await Promise.all([man(), man({ name: 'Ali' })]);
    await swipe(ayse, mehmet.id, 'PASS').expect(200);
    const locked = await http.post('/api/v1/swipes/rewind').set('Authorization', auth(ayse)).expect(403);
    expect(locked.body.error.code).toBe('FEATURE_LOCKED');

    await subscribe(ayse, 'plus');
    const rewound: RewindResultDto = (
      await http.post('/api/v1/swipes/rewind').set('Authorization', auth(ayse)).expect(200)
    ).body.data;
    expect(rewound.card?.id).toBe(mehmet.id);
    await swipe(ayse, mehmet.id, 'LIKE').expect(200);

    await swipe(ali, ayse.id, 'LIKE').expect(200);
    const matched = await swipe(ayse, ali.id, 'LIKE').expect(200);
    expect(matched.body.data.match).not.toBeNull();
    await http.post('/api/v1/swipes/rewind').set('Authorization', auth(ayse)).expect(409);
  });

  it('activates one Boost at a time and ranks boosted profiles first', async () => {
    const viewer = await man();
    const [plain, boosted] = await Promise.all([
      woman({ name: 'Ece', latitude: 41.01, longitude: 28.98 }),
      woman({ name: 'Zeynep', latitude: 41.2, longitude: 29.1, bio: null }),
    ]);
    const noBoost = await http.post('/api/v1/boosts').set('Authorization', auth(boosted)).expect(402);
    expect(noBoost.body.error.code).toBe('LIMIT_REACHED');

    await buy(boosted, { kind: 'PRODUCT', productSlug: 'boost-1' });
    const boost: BoostDto = (await http.post('/api/v1/boosts').set('Authorization', auth(boosted)).expect(201)).body
      .data;
    expect(new Date(boost.endsAt).getTime() - new Date(boost.startedAt).getTime()).toBe(30 * 60 * 1000);
    await http.post('/api/v1/boosts').set('Authorization', auth(boosted)).expect(409);
    expect((await entitlements(boosted)).boosts).toMatchObject({ remaining: 0, activeUntil: boost.endsAt });

    const feed: DiscoveryFeedDto = (await http.get('/api/v1/discovery').set('Authorization', auth(viewer)).expect(200))
      .body.data;
    expect(feed.cards.map((card) => card.id)).toEqual([boosted.id, plain.id]);
  });

  it('shows who liked you only to Premium users', async () => {
    const ayse = await woman();
    const mehmet = await man();
    await swipe(mehmet, ayse.id, 'LIKE').expect(200);

    const locked: LikesReceivedDto = (await http.get('/api/v1/likes').set('Authorization', auth(ayse)).expect(200))
      .body.data;
    expect(locked).toEqual({ locked: true, total: 1, items: [] });

    await subscribe(ayse, 'premium');
    const open: LikesReceivedDto = (await http.get('/api/v1/likes').set('Authorization', auth(ayse)).expect(200)).body
      .data;
    expect(open.locked).toBe(false);
    expect(open.items.map((item) => item.id)).toEqual([mehmet.id]);
    expect(open.items[0]).not.toHaveProperty('email');
  });

  it('gates incognito, passport and advanced filters behind entitlements', async () => {
    const ayse = await woman();
    const mehmet = await man();
    const settingsUrl = '/api/v1/profile/me/premium-settings';
    const lockedResponse = await http.put(settingsUrl).set('Authorization', auth(ayse)).send({ incognito: true }).expect(403);
    expect(lockedResponse.body.error.code).toBe('FEATURE_LOCKED');
    await http.put(settingsUrl).set('Authorization', auth(ayse)).send({ passportCity: 'Atlantis' }).expect(422);

    await subscribe(ayse, 'premium');
    await http.put(settingsUrl).set('Authorization', auth(ayse)).send({ incognito: true }).expect(200);
    const hidden: DiscoveryFeedDto = (await http.get('/api/v1/discovery').set('Authorization', auth(mehmet)).expect(200))
      .body.data;
    expect(hidden.cards).toHaveLength(0);
    await http.get(`/api/v1/profiles/${ayse.username}`).set('Authorization', auth(mehmet)).expect(404);

    await swipe(ayse, mehmet.id, 'LIKE').expect(200);
    const visible: DiscoveryFeedDto = (await http.get('/api/v1/discovery').set('Authorization', auth(mehmet)).expect(200))
      .body.data;
    expect(visible.cards.map((card) => card.id)).toEqual([ayse.id]);

    const ankaraMan = await man({ latitude: 39.93, longitude: 32.86 });
    const nearby: DiscoveryFeedDto = (await http.get('/api/v1/discovery').set('Authorization', auth(ayse)).expect(200))
      .body.data;
    expect(nearby.cards.map((card) => card.id)).not.toContain(ankaraMan.id);
    const updated = await http
      .put(settingsUrl)
      .set('Authorization', auth(ayse))
      .send({ passportCity: 'ankara', verifiedOnly: false })
      .expect(200);
    expect(updated.body.data).toMatchObject({ passportCity: 'Ankara', incognito: true });
    const passport: DiscoveryFeedDto = (await http.get('/api/v1/discovery').set('Authorization', auth(ayse)).expect(200))
      .body.data;
    expect(passport.cards.map((card) => card.id)).toEqual([ankaraMan.id]);

    await http.put(settingsUrl).set('Authorization', auth(ayse)).send({ verifiedOnly: true }).expect(200);
    const filtered: DiscoveryFeedDto = (await http.get('/api/v1/discovery').set('Authorization', auth(ayse)).expect(200))
      .body.data;
    expect(filtered.cards).toHaveLength(0);

    await simulate(ayse, 'expire').expect(200);
    const profile = await ctx.prisma.userProfile.findUniqueOrThrow({ where: { userId: ayse.id } });
    expect(profile.incognito).toBe(false);
    const afterExpiry: DiscoveryFeedDto = (
      await http.get('/api/v1/discovery').set('Authorization', auth(ayse)).expect(200)
    ).body.data;
    expect(afterExpiry.cards.map((card) => card.id)).not.toContain(ankaraMan.id);
  });
});
