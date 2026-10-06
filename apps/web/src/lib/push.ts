'use client';

import type { PushConfigDto } from '@dating/types';
import { api } from './api-client';

const SERVICE_WORKER_PATH = '/sw.js';

export type PushState = 'unsupported' | 'disabled-server' | 'denied' | 'subscribed' | 'unsubscribed';

function base64UrlToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function supported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function pushState(config: PushConfigDto): Promise<PushState> {
  if (!supported()) return 'unsupported';
  if (!config.enabled || !config.publicKey) return 'disabled-server';
  if (Notification.permission === 'denied') return 'denied';
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_PATH);
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? 'subscribed' : 'unsubscribed';
}

export async function enablePush(config: PushConfigDto): Promise<PushState> {
  if (!supported() || !config.publicKey) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'unsubscribed';

  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(config.publicKey),
    }));
  const json = subscription.toJSON();
  await api('/notifications/push/subscribe', {
    method: 'POST',
    body: { endpoint: subscription.endpoint, keys: json.keys },
  });
  return 'subscribed';
}

export async function disablePush(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_PATH);
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await api('/notifications/push/unsubscribe', { method: 'POST', body: { endpoint: subscription.endpoint } });
    await subscription.unsubscribe();
  }
  return 'unsubscribed';
}
