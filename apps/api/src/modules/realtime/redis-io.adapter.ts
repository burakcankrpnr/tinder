import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { ApiEnv } from '@dating/config';
import { Redis } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';
import { allowedOrigins } from '../../common/http/cors';

export const SOCKET_PATH = '/socket.io';

/** Birden fazla API instance'ı arasında oda yayınlarını Redis pub/sub ile paylaşır. */
export class RedisIoAdapter extends IoAdapter {
  private readonly pub: Redis;
  private readonly sub: Redis;

  constructor(
    app: INestApplicationContext,
    private readonly env: ApiEnv,
  ) {
    super(app);
    this.pub = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    this.sub = this.pub.duplicate();
  }

  override createIOServer(port: number, options?: Partial<ServerOptions>): Server {
    const merged: Partial<ServerOptions> = {
      ...options,
      path: SOCKET_PATH,
      serveClient: false,
      cors: { origin: allowedOrigins(this.env), credentials: true },
      maxHttpBufferSize: 64 * 1024,
      adapter: createAdapter(this.pub, this.sub, { key: 'socket.io' }),
    };
    // IoAdapter seçenekleri doğrudan `new Server(port, options)`'a iletir; orada Partial kabul edilir.
    return super.createIOServer(port, merged as ServerOptions) as Server;
  }

  override async close(server: Server): Promise<void> {
    await super.close(server);
    await Promise.allSettled([this.pub.quit(), this.sub.quit()]);
  }
}
