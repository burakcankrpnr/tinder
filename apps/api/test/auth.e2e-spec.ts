import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type TestContext, createTestApp } from './create-test-app';

const APP_ORIGIN = 'http://localhost:3000';
const PASSWORD = 'very-secret-pass-1';

function refreshCookie(response: request.Response): string {
  const header = response.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = header?.find((value) => value.startsWith('refresh_token='));
  if (!cookie) throw new Error('refresh_token cookie missing');
  return cookie.split(';')[0] ?? '';
}

describe('Auth flow (e2e)', () => {
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

  async function registerAndVerify(email: string): Promise<void> {
    await http
      .post('/api/v1/auth/register')
      .send({ email, password: PASSWORD, birthDate: '1995-05-20' })
      .expect(202);
    const token = ctx.mail.tokenFrom(email, '/verify-email');
    await http.post('/api/v1/auth/verify-email').send({ token }).expect(200);
  }

  function login(email: string, password = PASSWORD) {
    return http.post('/api/v1/auth/login').send({ email, password });
  }

  it('reports health of database, redis and storage', async () => {
    const response = await http.get('/api/v1/health').expect(200);
    expect(response.body).toEqual({
      success: true,
      data: { status: 'ok', checks: { database: true, redis: true, storage: true } },
    });
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('registers, blocks login until verified, then logs in', async () => {
    const email = 'ayse@example.com';
    await http
      .post('/api/v1/auth/register')
      .send({ email: 'Ayse@Example.com', password: PASSWORD, birthDate: '1995-05-20' })
      .expect(202);

    const unverified = await login(email).expect(403);
    expect(unverified.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    const token = ctx.mail.tokenFrom(email, '/verify-email');
    await http.post('/api/v1/auth/verify-email').send({ token }).expect(200);
    await http.post('/api/v1/auth/verify-email').send({ token }).expect(200);

    const response = await login(email).expect(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.user).toEqual({
      id: expect.any(String),
      email,
      emailVerified: true,
      role: 'USER',
      createdAt: expect.any(String),
    });

    const cookie = response.headers['set-cookie'] as unknown as string[];
    expect(cookie.join(';')).toMatch(/refresh_token=.*HttpOnly/i);

    const me = await http
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${response.body.data.accessToken}`)
      .expect(200);
    expect(me.body.data.email).toBe(email);
    expect(me.body.data).not.toHaveProperty('passwordHash');
    expect(me.body.data).not.toHaveProperty('birthDate');
  });

  it('starts a session on the first mobile registration so onboarding can begin', async () => {
    const email = 'yeni@example.com';
    const response = await http
      .post('/api/v1/auth/register')
      .set('X-Client', 'mobile')
      .send({ email, password: PASSWORD, birthDate: '1995-05-20' })
      .expect(202);

    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toEqual(expect.any(String));
    expect(response.body.data.user.emailVerified).toBe(false);

    const me = await http
      .get('/api/v1/profile/me')
      .set('Authorization', `Bearer ${response.body.data.accessToken}`)
      .expect(200);
    expect(me.body.data.onboarding).toEqual({ completed: false, nextStep: 'profile' });
  });

  it('returns the same response for duplicate registrations', async () => {
    const email = 'dup@example.com';
    const body = { email, password: PASSWORD, birthDate: '1990-01-01' };
    const first = await http.post('/api/v1/auth/register').send(body).expect(202);
    const second = await http.post('/api/v1/auth/register').send(body).expect(202);
    expect(second.body).toEqual(first.body);
    expect(ctx.mail.lastTo(email)?.subject).toBe('Zaten bir hesabın var');
    expect(await ctx.prisma.user.count()).toBe(1);
  });

  it('rejects underage users and invalid payloads', async () => {
    const underage = await http
      .post('/api/v1/auth/register')
      .send({ email: 'kid@example.com', password: PASSWORD, birthDate: '2015-01-01' })
      .expect(422);
    expect(underage.body.error.code).toBe('VALIDATION_ERROR');
    expect(await ctx.prisma.user.count()).toBe(0);
  });

  it('uses a generic error for unknown email and wrong password', async () => {
    await registerAndVerify('mehmet@example.com');
    const wrong = await login('mehmet@example.com', 'wrong-password-1').expect(401);
    const unknown = await login('nobody@example.com', 'wrong-password-1').expect(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('locks the account after repeated failed logins', async () => {
    const email = 'lock@example.com';
    await registerAndVerify(email);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await login(email, 'wrong-password-1').expect(401);
    }
    const locked = await login(email).expect(429);
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const email = 'rotate@example.com';
    await registerAndVerify(email);
    const loginResponse = await login(email).expect(200);
    const original = refreshCookie(loginResponse);

    const rotated = await http
      .post('/api/v1/auth/refresh')
      .set('Cookie', original)
      .set('Origin', APP_ORIGIN)
      .expect(200);
    const next = refreshCookie(rotated);
    expect(next).not.toBe(original);

    await http.post('/api/v1/auth/refresh').set('Cookie', original).expect(401);
    await http.post('/api/v1/auth/refresh').set('Cookie', next).expect(401);

    const reuse = await ctx.prisma.auditLog.count({
      where: { action: 'auth.refresh_token_reuse_detected' },
    });
    expect(reuse).toBe(1);
  });

  it('rejects refresh requests from foreign origins', async () => {
    const email = 'origin@example.com';
    await registerAndVerify(email);
    const cookie = refreshCookie(await login(email).expect(200));
    await http
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example')
      .expect(403);
  });

  it('logs out a single session and all sessions', async () => {
    const email = 'logout@example.com';
    await registerAndVerify(email);

    const first = await login(email).expect(200);
    const second = await login(email).expect(200);
    const sessions = await http
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${second.body.data.accessToken}`)
      .expect(200);
    expect(sessions.body.data).toHaveLength(2);

    await http.post('/api/v1/auth/logout').set('Cookie', refreshCookie(first)).expect(200);
    await http.post('/api/v1/auth/refresh').set('Cookie', refreshCookie(first)).expect(401);

    await http
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${second.body.data.accessToken}`)
      .expect(200);
    await http.post('/api/v1/auth/refresh').set('Cookie', refreshCookie(second)).expect(401);
  });

  it('resets the password via emailed token and revokes sessions', async () => {
    const email = 'reset@example.com';
    await registerAndVerify(email);
    const session = refreshCookie(await login(email).expect(200));

    await http.post('/api/v1/auth/forgot-password').send({ email }).expect(202);
    await http
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'ghost@example.com' })
      .expect(202);
    const token = ctx.mail.tokenFrom(email, '/reset-password');

    const newPassword = 'brand-new-pass-2';
    await http.post('/api/v1/auth/reset-password').send({ token, password: newPassword }).expect(200);
    await http.post('/api/v1/auth/reset-password').send({ token, password: newPassword }).expect(400);

    await http.post('/api/v1/auth/refresh').set('Cookie', session).expect(401);
    await login(email, PASSWORD).expect(401);
    await login(email, newPassword).expect(200);
  });

  it('rate limits registration attempts', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await http
        .post('/api/v1/auth/register')
        .send({ email: `rl${attempt}@example.com`, password: PASSWORD, birthDate: '1990-01-01' });
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 5).every((status) => status === 202)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it('requires authentication for protected routes', async () => {
    const response = await http.get('/api/v1/users/me').expect(401);
    expect(response.body).toMatchObject({ success: false, error: { code: 'UNAUTHORIZED' } });
    await http.get('/api/v1/users/me').set('Authorization', 'Bearer not-a-jwt').expect(401);
  });

  it('deletes an account only after password confirmation and blocks login', async () => {
    const email = 'silinecek@example.com';
    await registerAndVerify(email);
    const session = await login(email).expect(200);
    const token = session.body.data.accessToken as string;

    await http
      .post('/api/v1/users/me/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'wrong-password-1', confirmation: 'SİL' })
      .expect(401);

    await http
      .post('/api/v1/users/me/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: PASSWORD, confirmation: 'sil' })
      .expect(422);

    await http
      .post('/api/v1/users/me/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: PASSWORD, confirmation: 'SİL' })
      .expect(200);

    const user = await ctx.prisma.user.findFirst({ where: { id: session.body.data.user.id } });
    expect(user?.status).toBe('DEACTIVATED');
    expect(user?.deletedAt).toBeTruthy();
    expect(user?.email).toMatch(/^deleted-/);
    expect(user?.passwordHash).toBeNull();
    await login(email, PASSWORD).expect(401);
    await ctx.prisma.auditLog.findFirstOrThrow({ where: { action: 'account.deleted', targetId: user?.id } });
  });

  it('keeps Google OAuth disabled without credentials', async () => {
    const response = await http.get('/api/v1/auth/google').expect(404);
    expect(response.body.error.code).toBe('FEATURE_DISABLED');
  });
});
