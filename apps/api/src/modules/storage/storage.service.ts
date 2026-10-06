import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  NotFound,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { ApiEnv } from '@dating/config';
import { allowedOrigins } from '../../common/http/cors';
import { ENV } from '../../config/env.module';

export interface PresignedUpload {
  url: string;
  fields: Record<string, string>;
}

export interface StoredObjectInfo {
  size: number;
  contentType: string | null;
}

const UPLOAD_URL_TTL_SECONDS = 10 * 60;
const SIGNED_GET_TTL_SECONDS = 60 * 60;

function isNotFound(error: unknown): boolean {
  return (
    error instanceof NotFound ||
    (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404)
  );
}

/** S3 uyumlu storage (yerelde RustFS, prod'da S3 / R2). Uploads private, media public-read. */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;

  constructor(@Inject(ENV) private readonly env: ApiEnv) {
    this.client = new S3Client({
      endpoint: env.STORAGE_ENDPOINT,
      region: env.STORAGE_REGION,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY,
        secretAccessKey: env.STORAGE_SECRET_KEY,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.env.STORAGE_AUTO_PROVISION) return;
    await this.ensureBucket(this.env.STORAGE_UPLOAD_BUCKET);
    await this.ensureBucket(this.env.STORAGE_MEDIA_BUCKET);
    await this.client.send(
      new PutBucketPolicyCommand({
        Bucket: this.env.STORAGE_MEDIA_BUCKET,
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.env.STORAGE_MEDIA_BUCKET}/*`],
            },
          ],
        }),
      }),
    );
    await this.client.send(
      new PutBucketCorsCommand({
        Bucket: this.env.STORAGE_UPLOAD_BUCKET,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: allowedOrigins(this.env),
              AllowedMethods: ['POST'],
              AllowedHeaders: ['*'],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
  }

  private async ensureBucket(bucket: string): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (error) {
      if (!isNotFound(error)) throw error;
      await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
      this.logger.log(`Bucket oluşturuldu: ${bucket}`);
    }
  }

  async createUploadPost(
    key: string,
    contentType: string,
    maxBytes: number,
  ): Promise<PresignedUpload> {
    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: this.env.STORAGE_UPLOAD_BUCKET,
      Key: key,
      Conditions: [
        ['content-length-range', 1, maxBytes],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: { 'Content-Type': contentType },
      Expires: UPLOAD_URL_TTL_SECONDS,
    });
    return { url, fields };
  }

  async headUpload(key: string): Promise<StoredObjectInfo | null> {
    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.env.STORAGE_UPLOAD_BUCKET, Key: key }),
      );
      return { size: head.ContentLength ?? 0, contentType: head.ContentType ?? null };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async getMedia(key: string): Promise<{ body: Buffer; contentType: string | null } | null> {
    try {
      const object = await this.client.send(
        new GetObjectCommand({ Bucket: this.env.STORAGE_MEDIA_BUCKET, Key: key }),
      );
      if (!object.Body) return null;
      return {
        body: Buffer.from(await object.Body.transformToByteArray()),
        contentType: object.ContentType ?? null,
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async getUpload(key: string): Promise<Buffer> {
    const object = await this.client.send(
      new GetObjectCommand({ Bucket: this.env.STORAGE_UPLOAD_BUCKET, Key: key }),
    );
    if (!object.Body) throw new Error(`Empty object body for ${key}`);
    return Buffer.from(await object.Body.transformToByteArray());
  }

  async putMedia(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.env.STORAGE_MEDIA_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  /** Private bucket'a yazar; okuma yalnızca `signedUploadUrl` ile süreli yapılır. */
  async putPrivate(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.env.STORAGE_UPLOAD_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  signedUploadUrl(key: string, expiresInSeconds = SIGNED_GET_TTL_SECONDS): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.env.STORAGE_UPLOAD_BUCKET, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  async deleteUploads(keys: string[]): Promise<void> {
    await this.deleteMany(this.env.STORAGE_UPLOAD_BUCKET, keys);
  }

  async deleteMedia(keys: string[]): Promise<void> {
    await this.deleteMany(this.env.STORAGE_MEDIA_BUCKET, keys);
  }

  private async deleteMany(bucket: string, keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }

  publicUrl(key: string): string {
    return `${this.env.STORAGE_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.env.STORAGE_MEDIA_BUCKET }));
      return true;
    } catch {
      return false;
    }
  }
}
