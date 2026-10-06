import path from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

function withDatabase(url: string | undefined, database: string): string {
  const parsed = new URL(url ?? 'postgresql://dating:dating@localhost:5432/dating');
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

function withRedisDb(url: string | undefined, db: number): string {
  const parsed = new URL(url ?? 'redis://localhost:6380');
  parsed.pathname = `/${db}`;
  return parsed.toString();
}

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? withDatabase(process.env.DATABASE_URL, 'dating_test');
export const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? withRedisDb(process.env.REDIS_URL, 1);

export const TEST_UPLOAD_BUCKET = 'dating-test-uploads';
export const TEST_MEDIA_BUCKET = 'dating-test-media';
export const TEST_WEBHOOK_SECRET = 'test-webhook-secret-0123456789abcdef';

export function applyTestEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.DIRECT_DATABASE_URL = TEST_DATABASE_URL;
  process.env.REDIS_URL = TEST_REDIS_URL;
  process.env.GOOGLE_CLIENT_ID = '';
  process.env.GOOGLE_CLIENT_SECRET = '';
  process.env.STORAGE_UPLOAD_BUCKET = TEST_UPLOAD_BUCKET;
  process.env.STORAGE_MEDIA_BUCKET = TEST_MEDIA_BUCKET;
  process.env.STORAGE_PUBLIC_URL = `${process.env.STORAGE_ENDPOINT ?? 'http://localhost:9000'}/${TEST_MEDIA_BUCKET}`;
  process.env.STORAGE_AUTO_PROVISION = 'true';
  process.env.PAYMENT_PROVIDER = 'mock';
  process.env.PAYMENT_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
}
