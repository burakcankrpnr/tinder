import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { ClientToServerEvents, ServerToClientEvents } from '@dating/types';
import type { Namespace } from 'socket.io';

export type RealtimeNamespace = Namespace<ClientToServerEvents, ServerToClientEvents>;
type EventName = keyof ServerToClientEvents;

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

/**
 * Servislerin gateway'e bağımlı olmadan kullanıcılara olay göndermesini sağlar.
 * Redis adapter sayesinde kullanıcı hangi instance'a bağlı olursa olsun ulaşır.
 */
@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private namespace: RealtimeNamespace | null = null;

  attach(namespace: RealtimeNamespace): void {
    this.namespace = namespace;
  }

  /**
   * Kapanışta adapter'ın Redis bağlantıları kapatılmadan önce yayını durdurur; geç biten
   * async event listener'lar kapalı bağlantıya publish edip unhandled rejection üretmez.
   */
  onModuleDestroy(): void {
    this.namespace = null;
  }

  toUsers<E extends EventName>(
    userIds: string[],
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ): void {
    if (!this.namespace || userIds.length === 0) return;
    this.namespace.to(userIds.map(userRoom)).emit(event, ...args);
  }

  toUser<E extends EventName>(userId: string, event: E, ...args: Parameters<ServerToClientEvents[E]>): void {
    this.toUsers([userId], event, ...args);
  }

  /** Ban gibi durumlarda kullanıcının tüm instance'lardaki bağlantılarını kapatır. */
  disconnectUser(userId: string): void {
    this.namespace?.in(userRoom(userId)).disconnectSockets(true);
  }
}
