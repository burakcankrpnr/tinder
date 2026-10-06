import { randomUUID } from 'node:crypto';
import type {
  AdminDashboardDto,
  AdminPaymentDto,
  AdminPlanDto,
  AdminReportDto,
  AdminSubscriptionDto,
  AdminUserDetailDto,
  AdminVerificationDto,
  AnalyticsKpiDto,
  AuditLogDto,
  CatalogDto,
  CheckoutDto,
  EntitlementsDto,
  FeatureFlagDto,
  ModerationPhotoDto,
  Page,
  VerificationUploadDto,
} from '@dating/types';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { StorageService } from '../src/modules/storage/storage.service';
import { type TestContext, createTestApp } from './create-test-app';
import { type TestUser, createTestUser, eventually, loginToken, withRole } from './factories';

describe('Admin: RBAC, moderation, billing, flags, analytics (e2e)', () => {
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

  const auth = (user: TestUser) => `Bearer ${user.token}`;
  const woman = () => createTestUser(ctx, { name: 'Ayse', gender: 'WOMAN', interestedIn: ['MAN'] });
  const man = () => createTestUser(ctx, { name: 'Mehmet', gender: 'MAN', interestedIn: ['WOMAN'] });
  const admin = async () => withRole(ctx, await createTestUser(ctx, { name: 'Admin' }), 'ADMIN');
  const moderator = async () => withRole(ctx, await createTestUser(ctx, { name: 'Mod' }), 'MODERATOR');

  const get = (user: TestUser, path: string) => http.get(`/api/v1${path}`).set('Authorization', auth(user));
  const post = (user: TestUser, path: string, body: object = {}) =>
    http.post(`/api/v1${path}`).set('Authorization', auth(user)).send(body);
  const patch = (user: TestUser, path: string, body: object) =>
    http.patch(`/api/v1${path}`).set('Authorization', auth(user)).send(body);

  async function subscribe(user: TestUser, body: object): Promise<void> {
    const checkout: CheckoutDto = (
      await http
        .post('/api/v1/payments/checkout')
        .set('Authorization', auth(user))
        .set('Idempotency-Key', randomUUID())
        .send(body)
        .expect(201)
    ).body.data;
    await post(user, `/payments/mock/checkouts/${checkout.url.split('/').pop()}/complete`, { outcome: 'success' }).expect(200);
  }

  it('enforces roles and re-checks them against the database', async () => {
    const user = await woman();
    const mod = await moderator();
    const boss = await admin();

    await get(user, '/admin/users').expect(403);
    await get(mod, '/admin/users').expect(200);
    await get(mod, '/admin/dashboard').expect(403);
    await get(boss, '/admin/dashboard').expect(200);
    await http.get('/api/v1/admin/users').expect(401);

    // Rolü DB'de alınan moderatörün elindeki token artık işe yaramaz.
    await ctx.prisma.user.update({ where: { id: mod.id }, data: { role: 'USER' } });
    await get(mod, '/admin/users').expect(403);
  });

  it('bans a user: revokes sessions and tokens, hides them, and audits the action', async () => {
    const boss = await admin();
    const target = await man();
    const viewer = await woman();

    await patch(boss, `/admin/users/${boss.id}/status`, { status: 'BANNED', reason: 'kendini' }).expect(403);
    await patch(boss, `/admin/users/${target.id}/status`, { status: 'BANNED', reason: 'x' }).expect(422);

    const detail: AdminUserDetailDto = (
      await patch(boss, `/admin/users/${target.id}/status`, { status: 'BANNED', reason: 'Dolandırıcılık' }).expect(200)
    ).body.data;
    expect(detail.status).toBe('BANNED');
    expect(detail.activeSessions).toBe(0);

    await get(target, '/users/me').expect(401);
    await expect(loginToken(ctx, target.email)).rejects.toThrow();
    const feed = (await get(viewer, '/discovery').expect(200)).body.data;
    expect(feed.cards.map((card: { id: string }) => card.id)).not.toContain(target.id);

    const audit: Page<AuditLogDto> = (await get(boss, `/admin/audit-logs?targetId=${target.id}&action=moderation.`).expect(200)).body.data;
    expect(audit.items[0]).toMatchObject({ action: 'moderation.user_banned', actor: { id: boss.id } });

    await patch(boss, `/admin/users/${target.id}/status`, { status: 'ACTIVE', reason: 'İtiraz kabul edildi' }).expect(200);
    await expect(loginToken(ctx, target.email)).resolves.toEqual(expect.any(String));
  });

  it('lets only admins manage staff accounts', async () => {
    const mod = await moderator();
    const otherMod = await moderator();
    const boss = await admin();
    const user = await woman();

    await patch(mod, `/admin/users/${boss.id}/status`, { status: 'BANNED', reason: 'deneme' }).expect(403);
    await patch(mod, `/admin/users/${otherMod.id}/status`, { status: 'RESTRICTED', reason: 'deneme' }).expect(403);
    await patch(mod, `/admin/users/${user.id}/status`, { status: 'RESTRICTED', reason: 'Spam mesajlar' }).expect(200);
    await patch(mod, `/admin/users/${user.id}/role`, { role: 'ADMIN' }).expect(403);

    const promoted: AdminUserDetailDto = (await patch(boss, `/admin/users/${user.id}/role`, { role: 'MODERATOR' }).expect(200))
      .body.data;
    expect(promoted.role).toBe('MODERATOR');
    // Eski (USER rollü) access token iptal edildi.
    await get(user, '/users/me').expect(401);
  });

  it('works the report queue and applies sanctions exactly once', async () => {
    const mod = await moderator();
    const reporter = await woman();
    const reported = await man();
    await post(reporter, '/reports', { reportedUserId: reported.id, reason: 'SCAM', details: 'Para istedi' }).expect(201);

    const queue: Page<AdminReportDto> = (await get(mod, '/admin/reports?status=OPEN').expect(200)).body.data;
    expect(queue.items).toHaveLength(1);
    const report = queue.items[0]!;
    expect(report).toMatchObject({ reason: 'SCAM', reportedUser: { id: reported.id, status: 'ACTIVE' } });

    await post(mod, `/admin/reports/${report.id}/resolve`, { status: 'REVIEWING', action: 'BAN' }).expect(400);
    await post(mod, `/admin/reports/${report.id}/resolve`, { status: 'REVIEWING' }).expect(200);
    const results = await Promise.all([
      post(mod, `/admin/reports/${report.id}/resolve`, { status: 'RESOLVED', action: 'BAN', resolution: 'Dolandırıcılık' }),
      post(mod, `/admin/reports/${report.id}/resolve`, { status: 'DISMISSED' }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);

    const resolved: AdminReportDto = (await get(mod, `/admin/reports/${report.id}`).expect(200)).body.data;
    if (resolved.status === 'RESOLVED') {
      expect(resolved.reportedUser.status).toBe('BANNED');
    } else {
      expect(resolved.status).toBe('DISMISSED');
    }
  });

  it('restricts accounts reported as underage until a moderator reviews them', async () => {
    const reporter = await woman();
    const reported = await man();
    await post(reporter, '/reports', { reportedUserId: reported.id, reason: 'UNDERAGE' }).expect(201);
    await eventually(async () =>
      (await ctx.prisma.user.findUniqueOrThrow({ where: { id: reported.id } })).status === 'RESTRICTED',
    );
  });

  it('reviews photos flagged by automated moderation', async () => {
    const mod = await moderator();
    const user = await woman();
    const photo = await ctx.prisma.userPhoto.create({
      data: {
        userId: user.id,
        position: 5,
        status: 'PENDING_REVIEW',
        uploadKey: `users/${user.id}/review`,
        contentType: 'image/jpeg',
        moderationScore: 0.6,
      },
    });

    const queue: Page<ModerationPhotoDto> = (await get(mod, '/admin/moderation/photos').expect(200)).body.data;
    expect(queue.items.map((item) => item.id)).toEqual([photo.id]);

    await post(mod, `/admin/moderation/photos/${photo.id}`, { decision: 'REJECT' }).expect(422);
    await post(mod, `/admin/moderation/photos/${photo.id}`, { decision: 'REJECT', reason: 'Çıplaklık' }).expect(204);
    await post(mod, `/admin/moderation/photos/${photo.id}`, { decision: 'APPROVE' }).expect(409);
    const rejected = await ctx.prisma.userPhoto.findUniqueOrThrow({ where: { id: photo.id } });
    expect(rejected).toMatchObject({ status: 'REJECTED', rejectReason: 'Çıplaklık' });
  });

  it('verifies a user through a selfie reviewed by a moderator', async () => {
    const mod = await moderator();
    const user = await woman();

    const started: VerificationUploadDto = (
      await post(user, '/verification', { contentType: 'image/jpeg', size: 1000 }).expect(201)
    ).body.data;
    expect(started.gesture.length).toBeGreaterThan(0);
    await post(user, `/verification/${started.requestId}/submit`).expect(400);

    const request = await ctx.prisma.verificationRequest.findUniqueOrThrow({ where: { id: started.requestId } });
    await ctx.app.get(StorageService).putPrivate(request.selfieKey, Buffer.from('selfie'), 'image/jpeg');
    const submitted = (await post(user, `/verification/${started.requestId}/submit`).expect(200)).body.data;
    expect(submitted).toMatchObject({ status: 'PENDING', request: { status: 'PENDING' } });
    await post(user, '/verification', { contentType: 'image/jpeg', size: 1000 }).expect(409);

    const queue: Page<AdminVerificationDto> = (await get(mod, '/admin/moderation/verifications').expect(200)).body.data;
    expect(queue.items[0]).toMatchObject({ id: started.requestId, userId: user.id });
    expect(queue.items[0]?.selfieUrl).toContain('X-Amz-Signature');

    await post(mod, `/admin/moderation/verifications/${started.requestId}`, { decision: 'APPROVE' }).expect(204);
    await post(mod, `/admin/moderation/verifications/${started.requestId}`, { decision: 'APPROVE' }).expect(409);
    expect((await get(user, '/verification').expect(200)).body.data.status).toBe('VERIFIED');
    const profile = await ctx.prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(profile.verificationStatus).toBe('VERIFIED');
  });

  it('refunds payments through the provider and revokes unused purchased entitlements', async () => {
    const boss = await admin();
    const user = await woman();
    await subscribe(user, { kind: 'PRODUCT', productSlug: 'super-like-5' });
    expect(((await get(user, '/billing/entitlements').expect(200)).body.data as EntitlementsDto).superLikes.remaining).toBe(5);

    const payments: Page<AdminPaymentDto> = (await get(boss, `/admin/payments?userId=${user.id}`).expect(200)).body.data;
    const payment = payments.items[0]!;
    expect(payment).toMatchObject({ status: 'SUCCEEDED', email: user.email });

    const results = await Promise.all([
      post(boss, `/admin/payments/${payment.id}/refund`, { reason: 'Müşteri talebi' }),
      post(boss, `/admin/payments/${payment.id}/refund`, { reason: 'Müşteri talebi' }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    await eventually(async () =>
      (await ctx.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status === 'REFUNDED',
    );
    await post(boss, `/admin/payments/${payment.id}/refund`, { reason: 'Tekrar' }).expect(409);
    expect(((await get(user, '/billing/entitlements').expect(200)).body.data as EntitlementsDto).superLikes.remaining).toBe(0);
  });

  it('cancels subscriptions and manages plans', async () => {
    const boss = await admin();
    const user = await woman();
    await subscribe(user, { kind: 'SUBSCRIPTION', planSlug: 'plus', interval: 'MONTHLY' });

    const subs: Page<AdminSubscriptionDto> = (await get(boss, '/admin/subscriptions?state=ACTIVE').expect(200)).body.data;
    expect(subs.items).toHaveLength(1);
    await post(boss, `/admin/subscriptions/${subs.items[0]!.id}/cancel`, { immediately: true, reason: 'Hileli ödeme' }).expect(204);
    expect(((await get(user, '/billing/entitlements').expect(200)).body.data as EntitlementsDto).plan.slug).toBe('free');

    const plans: AdminPlanDto[] = (await get(boss, '/admin/plans').expect(200)).body.data;
    const plus = plans.find((plan) => plan.slug === 'plus')!;
    const free = plans.find((plan) => plan.slug === 'free')!;
    await patch(boss, `/admin/plans/${free.id}`, { active: false }).expect(400);
    await patch(boss, `/admin/plans/${plus.id}`, { monthlyPrice: 12999 }).expect(200);
    const catalog: CatalogDto = (await http.get('/api/v1/billing/plans').expect(200)).body.data;
    expect(catalog.plans.find((plan) => plan.slug === 'plus')?.monthlyPrice).toBe(12999);
    await patch(boss, `/admin/plans/${plus.id}`, { monthlyPrice: plus.monthlyPrice }).expect(200);
  });

  it('applies feature overrides and admin grants through the entitlement service', async () => {
    const boss = await admin();
    const user = await woman();

    await http
      .put(`/api/v1/admin/users/${user.id}/overrides`)
      .set('Authorization', auth(boss))
      .send({ feature: 'rewind', value: true })
      .expect(200);
    await post(boss, `/admin/users/${user.id}/entitlements`, { type: 'BOOST', quantity: 2, reason: 'Kampanya' }).expect(201);

    const summary: EntitlementsDto = (await get(user, '/billing/entitlements').expect(200)).body.data;
    expect(summary.features.rewind).toBe(true);
    expect(summary.boosts.remaining).toBe(2);

    await http
      .delete(`/api/v1/admin/users/${user.id}/overrides/rewind`)
      .set('Authorization', auth(boss))
      .expect(200);
    expect(((await get(user, '/billing/entitlements').expect(200)).body.data as EntitlementsDto).features.rewind).toBe(false);
  });

  it('rolls out feature flags per user', async () => {
    await ctx.prisma.featureFlag.deleteMany({ where: { key: 'NEW_ONBOARDING' } });
    await ctx.prisma.featureFlag.update({ where: { key: 'BOOST_V2' }, data: { enabled: false, rolloutPercent: 0 } });
    const boss = await admin();
    const user = await woman();

    const flags: FeatureFlagDto[] = (await get(boss, '/admin/feature-flags').expect(200)).body.data;
    expect(flags.map((flag) => flag.key)).toContain('BOOST_V2');
    expect((await get(user, '/feature-flags').expect(200)).body.data.flags.BOOST_V2).toBe(false);

    await patch(boss, '/admin/feature-flags/BOOST_V2', { enabled: true, rolloutPercent: 100 }).expect(200);
    expect((await get(user, '/feature-flags').expect(200)).body.data.flags.BOOST_V2).toBe(true);
    await patch(boss, '/admin/feature-flags/BOOST_V2', { rolloutPercent: 0 }).expect(200);
    expect((await get(user, '/feature-flags').expect(200)).body.data.flags.BOOST_V2).toBe(false);

    await post(boss, '/admin/feature-flags', { key: 'BOOST_V2', description: 'Tekrar' }).expect(409);
    await post(boss, '/admin/feature-flags', { key: 'NEW_ONBOARDING', description: 'Yeni onboarding' }).expect(201);
  });

  it('collects analytics events and reports KPIs and dashboard metrics', async () => {
    const boss = await admin();
    const ayse = await woman();
    const mehmet = await man();

    const clientId = randomUUID();
    await http.post('/api/v1/analytics/events').send({ name: 'SIGNUP_STARTED', clientId }).expect(202);
    await http.post('/api/v1/analytics/events').send({ name: 'SWIPE_LIKED', clientId: randomUUID() }).expect(422);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await http
        .post('/api/v1/analytics/events')
        .set('Authorization', auth(ayse))
        .send({ name: 'APP_OPENED', clientId, platform: 'web' })
        .expect(202);
    }
    expect(await ctx.prisma.analyticsEvent.count({ where: { userId: ayse.id, name: 'APP_OPENED' } })).toBe(1);

    await post(ayse, '/swipes', { targetUserId: mehmet.id, action: 'LIKE' }).expect(200);
    await post(mehmet, '/swipes', { targetUserId: ayse.id, action: 'LIKE' }).expect(200);
    await eventually(async () => (await ctx.prisma.analyticsEvent.count({ where: { name: 'MATCH_CREATED' } })) === 2);

    const kpi: AnalyticsKpiDto = (await get(boss, '/admin/analytics?marketingSpend=100000').expect(200)).body.data;
    expect(kpi.dau).toBeGreaterThanOrEqual(2);
    expect(kpi.matchRate).toBe(0.5);
    const counts = Object.fromEntries(kpi.events.map((event) => [event.name, event.count]));
    expect(counts).toMatchObject({ SWIPE_LIKED: 2, MATCH_CREATED: 2, APP_OPENED: 1, SIGNUP_STARTED: 1 });

    const filtered: AnalyticsKpiDto = (await get(boss, '/admin/analytics?country=DE').expect(200)).body.data;
    expect(filtered.dau).toBe(0);
    await get(boss, '/admin/analytics?from=2026-02-10&to=2026-01-01').expect(422);

    const dashboard: AdminDashboardDto = (await get(boss, '/admin/dashboard?days=7').expect(200)).body.data;
    expect(dashboard.users.total).toBe(3);
    expect(dashboard.matches).toBe(1);
    expect(dashboard.signupsByDay).toHaveLength(7);
  });
});
