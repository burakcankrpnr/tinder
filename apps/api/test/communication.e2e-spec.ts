import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type {
  ApiResponse,
  ChatAttachmentUploadDto,
  ChatMessageDto,
  ClientToServerEvents,
  DiscoveryFeedDto,
  MatchListDto,
  MessagePageDto,
  NotificationPageDto,
  ServerToClientEvents,
  SwipeResultDto,
} from '@dating/types';
import sharp from 'sharp';
import { type Socket, io } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AUTO_RESTRICT_REPORTERS } from '../src/modules/safety/reports.service';
import { type TestContext, createTestApp } from './create-test-app';
import { type TestUser, createTestUser } from './factories';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

async function eventually<T>(probe: () => Promise<T | undefined | null | false>, timeoutMs = 3000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('Condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function nextEvent<E extends keyof ServerToClientEvents>(
  socket: ClientSocket,
  event: E,
  timeoutMs = 3000,
): Promise<Parameters<ServerToClientEvents[E]>[0]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${String(event)}`)), timeoutMs);
    const handler = (payload: Parameters<ServerToClientEvents[E]>[0]) => {
      clearTimeout(timer);
      resolve(payload);
    };
    // socket.io-client tipleri genel dinleyiciyi olay bazında daraltamıyor.
    (socket as unknown as { once: (name: string, fn: (payload: unknown) => void) => void }).once(
      event,
      handler as (payload: unknown) => void,
    );
  });
}

describe('Matches, chat, safety & notifications (e2e)', () => {
  let ctx: TestContext;
  let http: ReturnType<typeof request>;
  let baseUrl: string;
  const sockets: ClientSocket[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.listen(0);
    const { port } = ctx.app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
    http = request(ctx.app.getHttpServer());
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    for (const socket of sockets.splice(0)) socket.disconnect();
    await ctx.reset();
  });

  const woman = (overrides: Parameters<typeof createTestUser>[1] = {}) =>
    createTestUser(ctx, { name: 'Ayse', gender: 'WOMAN', interestedIn: ['MAN'], ...overrides });
  const man = (overrides: Parameters<typeof createTestUser>[1] = {}) =>
    createTestUser(ctx, { name: 'Mehmet', gender: 'MAN', interestedIn: ['WOMAN'], ...overrides });

  const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` });

  async function like(actor: TestUser, target: TestUser): Promise<SwipeResultDto> {
    const response = await http
      .post('/api/v1/swipes')
      .set(auth(actor))
      .send({ targetUserId: target.id, action: 'LIKE' })
      .expect(200);
    return response.body.data as SwipeResultDto;
  }

  async function matchPair(): Promise<{ a: TestUser; b: TestUser; matchId: string }> {
    const a = await woman();
    const b = await man();
    await like(a, b);
    const result = await like(b, a);
    if (!result.match) throw new Error('expected match');
    return { a, b, matchId: result.match.id };
  }

  function sendText(user: TestUser, matchId: string, body: string, clientMessageId: string = randomUUID()) {
    return http
      .post(`/api/v1/matches/${matchId}/messages`)
      .set(auth(user))
      .send({ type: 'TEXT', clientMessageId, body });
  }

  async function connect(user: TestUser): Promise<ClientSocket> {
    const socket: ClientSocket = io(`${baseUrl}/realtime`, {
      path: '/socket.io',
      auth: { token: user.token },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    return socket;
  }

  async function notifications(user: TestUser): Promise<NotificationPageDto> {
    const response = await http.get('/api/v1/notifications').set(auth(user)).expect(200);
    return response.body.data as NotificationPageDto;
  }

  it('lists matches with last message, unread count and supports unmatch', async () => {
    const { a, b, matchId } = await matchPair();

    let list = (await http.get('/api/v1/matches').set(auth(a)).expect(200)).body.data as MatchListDto;
    expect(list.matches).toHaveLength(1);
    expect(list.matches[0]).toMatchObject({ id: matchId, lastMessage: null, unreadCount: 0, online: false });
    expect(list.matches[0]?.user).toMatchObject({ id: b.id, firstName: 'Mehmet' });
    expect(list.matches[0]?.user).not.toHaveProperty('email');

    await sendText(b, matchId, 'Merhaba!').expect(201);
    await sendText(b, matchId, 'Nasılsın?').expect(201);
    list = (await http.get('/api/v1/matches').set(auth(a)).expect(200)).body.data as MatchListDto;
    expect(list.matches[0]).toMatchObject({
      unreadCount: 2,
      lastMessage: { preview: 'Nasılsın?', fromMe: false, type: 'TEXT', deleted: false },
    });

    const outsider = await woman({ name: 'Elif' });
    await http.get(`/api/v1/matches/${matchId}`).set(auth(outsider)).expect(404);
    await http.get(`/api/v1/matches/${matchId}/messages`).set(auth(outsider)).expect(404);
    await sendText(outsider, matchId, 'selam').expect(404);

    await http.delete(`/api/v1/matches/${matchId}`).set(auth(a)).expect(200);
    await http.delete(`/api/v1/matches/${matchId}`).set(auth(a)).expect(404);
    await sendText(b, matchId, 'Hâlâ orada mısın?').expect(404);
    list = (await http.get('/api/v1/matches').set(auth(b)).expect(200)).body.data as MatchListDto;
    expect(list.matches).toHaveLength(0);
    const stored = await ctx.prisma.match.findUniqueOrThrow({ where: { id: matchId } });
    expect(stored).toMatchObject({ status: 'UNMATCHED', endedById: a.id });
  });

  it('sends messages idempotently, paginates and marks them read', async () => {
    const { a, b, matchId } = await matchPair();
    const clientMessageId = randomUUID();

    const first = (await sendText(a, matchId, 'Selam', clientMessageId).expect(201)).body.data as ChatMessageDto;
    const retry = (await sendText(a, matchId, 'Selam', clientMessageId).expect(201)).body.data as ChatMessageDto;
    expect(retry.id).toBe(first.id);
    const [concurrentOne, concurrentTwo] = await Promise.all([
      sendText(a, matchId, 'Aynı anda', '8b7c6a46-8a43-4f39-9a8e-5f6f3fd7b3a1'),
      sendText(a, matchId, 'Aynı anda', '8b7c6a46-8a43-4f39-9a8e-5f6f3fd7b3a1'),
    ]);
    expect(concurrentOne.body.data.id).toBe(concurrentTwo.body.data.id);

    for (let index = 0; index < 4; index += 1) await sendText(b, matchId, `Mesaj ${index}`).expect(201);
    expect(await ctx.prisma.message.count()).toBe(6);

    const page1 = (await http.get(`/api/v1/matches/${matchId}/messages?limit=4`).set(auth(a)).expect(200)).body
      .data as MessagePageDto;
    expect(page1.messages.map((message) => message.body)).toEqual(['Mesaj 0', 'Mesaj 1', 'Mesaj 2', 'Mesaj 3']);
    expect(page1.nextCursor).toBe(page1.messages[0]?.id);
    const page2 = (
      await http.get(`/api/v1/matches/${matchId}/messages?limit=4&before=${page1.nextCursor}`).set(auth(a)).expect(200)
    ).body.data as MessagePageDto;
    expect(page2.messages.map((message) => message.body)).toEqual(['Selam', 'Aynı anda']);
    expect(page2.nextCursor).toBeNull();

    const read = await http.post(`/api/v1/matches/${matchId}/read`).set(auth(a)).send({}).expect(200);
    expect(read.body.data).toEqual({ updated: 4 });
    const after = (await http.get(`/api/v1/matches/${matchId}/messages`).set(auth(b)).expect(200)).body
      .data as MessagePageDto;
    expect(after.messages.filter((message) => message.senderId === b.id).every((message) => message.readAt)).toBe(true);
    expect(after.messages.filter((message) => message.senderId === a.id).every((message) => !message.readAt)).toBe(true);

    await sendText(a, matchId, '   ').expect(422);
    await sendText(a, matchId, 'x'.repeat(2001)).expect(422);
  });

  it('delivers messages, typing, read receipts and presence over Socket.IO', async () => {
    const { a, b, matchId } = await matchPair();
    await expect(
      new Promise((resolve, reject) => {
        const socket = io(`${baseUrl}/realtime`, {
          path: '/socket.io',
          auth: { token: 'invalid' },
          transports: ['websocket'],
          reconnection: false,
          forceNew: true,
        });
        socket.once('connect', () => resolve('connected'));
        socket.once('connect_error', (error) => {
          socket.disconnect();
          reject(error);
        });
      }),
    ).rejects.toThrow('UNAUTHORIZED');

    const socketB = await connect(b);
    const presence = nextEvent(socketB, 'presence');
    const socketA = await connect(a);
    expect(await presence).toEqual({ userId: a.id, online: true });

    const detail = await http.get(`/api/v1/matches/${matchId}`).set(auth(b)).expect(200);
    expect(detail.body.data.online).toBe(true);

    const typing = nextEvent(socketB, 'typing');
    socketA.emit('typing', { matchId, isTyping: true });
    expect(await typing).toEqual({ matchId, userId: a.id, isTyping: true });

    const incoming = nextEvent(socketB, 'message:new');
    const ack = await new Promise<ApiResponse<ChatMessageDto>>((resolve) => {
      socketA.emit(
        'message:send',
        { matchId, message: { type: 'TEXT', clientMessageId: randomUUID(), body: 'Socket üzerinden selam' } },
        resolve,
      );
    });
    expect(ack.success).toBe(true);
    const delivered = await incoming;
    expect(delivered).toMatchObject({ matchId, senderId: a.id, body: 'Socket üzerinden selam' });
    if (ack.success) expect(delivered.id).toBe(ack.data.id);

    const invalid = await new Promise<ApiResponse<ChatMessageDto>>((resolve) => {
      socketA.emit('message:send', { matchId, message: { type: 'TEXT', body: '' } }, resolve);
    });
    expect(invalid).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });

    const receipt = nextEvent(socketA, 'message:read');
    await http.post(`/api/v1/matches/${matchId}/read`).set(auth(b)).send({}).expect(200);
    expect(await receipt).toMatchObject({ matchId, readerId: b.id, upToMessageId: delivered.id });

    const deleted = nextEvent(socketB, 'message:deleted');
    await http.delete(`/api/v1/messages/${delivered.id}`).set(auth(b)).expect(404);
    await http.delete(`/api/v1/messages/${delivered.id}`).set(auth(a)).expect(200);
    expect(await deleted).toEqual({ matchId, messageId: delivered.id });
    const page = (await http.get(`/api/v1/matches/${matchId}/messages`).set(auth(b)).expect(200)).body
      .data as MessagePageDto;
    expect(page.messages[0]).toMatchObject({ id: delivered.id, deleted: true, body: null });

    const offline = nextEvent(socketB, 'presence');
    socketA.disconnect();
    expect(await offline).toEqual({ userId: a.id, online: false });
  });

  it('sends image messages through the private storage pipeline', async () => {
    const { a, b, matchId } = await matchPair();
    const upload = (
      await http
        .post(`/api/v1/matches/${matchId}/attachments`)
        .set(auth(a))
        .send({ contentType: 'image/png', size: 5000 })
        .expect(201)
    ).body.data as ChatAttachmentUploadDto;
    const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 10, g: 200, b: 90 } } })
      .png()
      .toBuffer();
    const form = new FormData();
    for (const [key, value] of Object.entries(upload.upload.fields)) form.append(key, value);
    form.append('file', new Blob([new Uint8Array(png)], { type: 'image/png' }));
    expect((await fetch(upload.upload.url, { method: 'POST', body: form })).ok).toBe(true);

    await http
      .post(`/api/v1/matches/${matchId}/messages`)
      .set(auth(b))
      .send({ type: 'IMAGE', clientMessageId: randomUUID(), attachmentKey: upload.attachmentKey })
      .expect(400);

    const sent = (
      await http
        .post(`/api/v1/matches/${matchId}/messages`)
        .set(auth(a))
        .send({ type: 'IMAGE', clientMessageId: randomUUID(), attachmentKey: upload.attachmentKey })
        .expect(201)
    ).body.data as ChatMessageDto;
    expect(sent.image).toMatchObject({ width: 64, height: 48 });
    const image = await fetch(sent.image!.url);
    expect(image.status).toBe(200);
    expect((await sharp(Buffer.from(await image.arrayBuffer())).metadata()).format).toBe('webp');

    const list = (await http.get('/api/v1/matches').set(auth(b)).expect(200)).body.data as MatchListDto;
    expect(list.matches[0]?.lastMessage).toMatchObject({ type: 'IMAGE', preview: '' });
  });

  it('blocking ends the match and hides users everywhere', async () => {
    const { a, b, matchId } = await matchPair();
    const c = await man({ name: 'Can' });

    let feed = (await http.get('/api/v1/discovery').set(auth(a)).expect(200)).body.data as DiscoveryFeedDto;
    expect(feed.cards.map((card) => card.id)).toEqual([c.id]);

    await http.post('/api/v1/blocks').set(auth(c)).send({ userId: a.id }).expect(200);
    await http.post('/api/v1/blocks').set(auth(c)).send({ userId: a.id }).expect(200);
    feed = (await http.get('/api/v1/discovery').set(auth(a)).expect(200)).body.data as DiscoveryFeedDto;
    expect(feed.cards).toHaveLength(0);
    await http.get(`/api/v1/profiles/${c.username}`).set(auth(a)).expect(404);
    await http.post('/api/v1/swipes').set(auth(a)).send({ targetUserId: c.id, action: 'LIKE' }).expect(404);

    await http.post('/api/v1/blocks').set(auth(a)).send({ userId: b.id }).expect(200);
    expect(await ctx.prisma.match.findUniqueOrThrow({ where: { id: matchId } })).toMatchObject({ status: 'BLOCKED' });
    await sendText(b, matchId, 'selam').expect(404);
    const list = (await http.get('/api/v1/matches').set(auth(b)).expect(200)).body.data as MatchListDto;
    expect(list.matches).toHaveLength(0);

    const blocked = await http.get('/api/v1/blocks').set(auth(a)).expect(200);
    expect(blocked.body.data).toEqual([expect.objectContaining({ userId: b.id, firstName: 'Mehmet' })]);
    await http.delete(`/api/v1/blocks/${b.id}`).set(auth(a)).expect(200);
    expect((await http.get('/api/v1/blocks').set(auth(a)).expect(200)).body.data).toEqual([]);
    expect(await ctx.prisma.match.findUniqueOrThrow({ where: { id: matchId } })).toMatchObject({ status: 'BLOCKED' });

    await http.post('/api/v1/blocks').set(auth(a)).send({ userId: a.id }).expect(400);
  });

  it('records reports idempotently, validates reported messages and auto-restricts', async () => {
    const { a, b, matchId } = await matchPair();
    const theirs = (await sendText(b, matchId, 'kaba bir mesaj').expect(201)).body.data as ChatMessageDto;
    const mine = (await sendText(a, matchId, 'benim mesajım').expect(201)).body.data as ChatMessageDto;

    const first = await http
      .post('/api/v1/reports')
      .set(auth(a))
      .send({ reportedUserId: b.id, reason: 'HARASSMENT', messageId: theirs.id, details: 'Rahatsız edici' })
      .expect(201);
    const duplicate = await http
      .post('/api/v1/reports')
      .set(auth(a))
      .send({ reportedUserId: b.id, reason: 'HARASSMENT', messageId: theirs.id })
      .expect(201);
    expect(duplicate.body.data.id).toBe(first.body.data.id);
    await http
      .post('/api/v1/reports')
      .set(auth(a))
      .send({ reportedUserId: b.id, reason: 'SPAM', messageId: mine.id })
      .expect(404);
    await http.post('/api/v1/reports').set(auth(a)).send({ reportedUserId: b.id, reason: 'NOPE' }).expect(422);
    await http.post('/api/v1/reports').set(auth(a)).send({ reportedUserId: a.id, reason: 'SPAM' }).expect(400);

    const withBlock = await http
      .post('/api/v1/reports')
      .set(auth(a))
      .send({ reportedUserId: b.id, reason: 'FAKE_PROFILE', block: true })
      .expect(201);
    expect(withBlock.body.data.blocked).toBe(true);
    expect(await ctx.prisma.match.findUniqueOrThrow({ where: { id: matchId } })).toMatchObject({ status: 'BLOCKED' });

    const target = await man({ name: 'Spammer' });
    for (let index = 0; index < AUTO_RESTRICT_REPORTERS; index += 1) {
      const reporter = await woman({ name: `Reporter${index}` });
      await http.post('/api/v1/reports').set(auth(reporter)).send({ reportedUserId: target.id, reason: 'SCAM' }).expect(201);
      const status = (await ctx.prisma.user.findUniqueOrThrow({ where: { id: target.id } })).status;
      expect(status).toBe(index + 1 >= AUTO_RESTRICT_REPORTERS ? 'RESTRICTED' : 'ACTIVE');
    }
    expect(await ctx.prisma.report.count({ where: { reportedUserId: target.id } })).toBe(AUTO_RESTRICT_REPORTERS);
  });

  it('creates grouped notifications respecting preferences', async () => {
    const a = await woman();
    const b = await man();
    const socketB = await connect(b);

    const liked = nextEvent(socketB, 'notification:new');
    await like(a, b);
    expect(await liked).toMatchObject({ type: 'SOMEONE_LIKED_YOU', href: '/likes' });

    const matchEvent = nextEvent(socketB, 'match:new');
    const result = await like(b, a);
    const matchId = result.match!.id;
    expect(await matchEvent).toMatchObject({ id: matchId, user: { id: a.id } });

    const forA = await eventually(async () => {
      const page = await notifications(a);
      return page.notifications.some((item) => item.type === 'NEW_MATCH') ? page : null;
    });
    expect(forA.notifications.find((item) => item.type === 'NEW_MATCH')).toMatchObject({
      title: 'Yeni eşleşme!',
      href: `/matches/${matchId}`,
    });
    await eventually(async () => ctx.mail.lastTo(a.email)?.subject === 'Yeni eşleşme!');
    expect((await notifications(b)).notifications.some((item) => item.type === 'SOMEONE_LIKED_YOU')).toBe(true);

    await sendText(a, matchId, 'Selam').expect(201);
    await sendText(a, matchId, 'Orada mısın?').expect(201);
    const grouped = await eventually(async () => {
      const page = await notifications(b);
      const message = page.notifications.find((item) => item.type === 'NEW_MESSAGE');
      return message?.count === 2 ? message : null;
    });
    expect(grouped).toMatchObject({ title: 'Ayse sana yazdı', body: '2 yeni mesaj', href: `/matches/${matchId}` });

    await http.post(`/api/v1/matches/${matchId}/read`).set(auth(b)).send({}).expect(200);
    expect(
      (await notifications(b)).notifications.find((item) => item.type === 'NEW_MESSAGE')?.readAt,
    ).not.toBeNull();

    const prefs = await http.put('/api/v1/notifications/preferences').set(auth(b)).send({ newMessage: false });
    expect(prefs.body.data).toMatchObject({ newMessage: false, newMatch: true });
    await sendText(a, matchId, 'Bildirim gelmemeli').expect(201);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await ctx.prisma.notification.count({ where: { userId: b.id, type: 'NEW_MESSAGE' } })).toBe(1);

    const marked = await http.post('/api/v1/notifications/read').set(auth(b)).send({ all: true }).expect(200);
    expect(marked.body.data).toEqual({ unreadCount: 0 });

    await http.delete(`/api/v1/matches/${matchId}`).set(auth(a)).expect(200);
    await eventually(async () =>
      (await ctx.prisma.notification.count({ where: { userId: { in: [a.id, b.id] }, type: { in: ['NEW_MATCH', 'NEW_MESSAGE'] } } })) === 0,
    );
  });

  it('manages web push subscriptions', async () => {
    const user = await woman();
    const config = await http.get('/api/v1/notifications/push/config').set(auth(user)).expect(200);
    expect(config.body.data).toEqual({ enabled: false, publicKey: null });

    const subscription = {
      endpoint: 'https://push.example.com/send/abc',
      keys: { p256dh: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U', auth: 'tBHItJI5svbpez7KI4CCXg' },
    };
    await http.post('/api/v1/notifications/push/subscribe').set(auth(user)).send(subscription).expect(200);
    await http.post('/api/v1/notifications/push/subscribe').set(auth(user)).send(subscription).expect(200);
    expect(await ctx.prisma.device.count({ where: { userId: user.id } })).toBe(1);
    await http
      .post('/api/v1/notifications/push/unsubscribe')
      .set(auth(user))
      .send({ endpoint: subscription.endpoint })
      .expect(200);
    expect(await ctx.prisma.device.count()).toBe(0);
  });
});
