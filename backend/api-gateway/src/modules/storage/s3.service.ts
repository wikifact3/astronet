import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly buckets: { quarantine: string; approved: string; invoices: string };

  constructor(private readonly configService: ConfigService) {
    const cfg = this.configService.get('storage.s3');
    this.client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      credentials: {
        accessKeyId: cfg.accessKey,
        secretAccessKey: cfg.secretKey,
      },
      forcePathStyle: cfg.forcePathStyle,
    });
    this.buckets =
      this.configService.get<{ quarantine: string; approved: string; invoices: string }>(
        'storage.buckets',
      ) ?? {
        quarantine: 'powerlink-kyc-quarantine',
        approved: 'powerlink-kyc-approved',
        invoices: 'powerlink-invoices',
      };
  }

  async onModuleInit(): Promise<void> {
    // Fail fast if MinIO / S3 isn't reachable — otherwise the first upload
    // would fail with a confusing error.
    try {
      await Promise.all([
        this.client.send(new HeadBucketCommand({ Bucket: this.buckets.quarantine })),
        this.client.send(new HeadBucketCommand({ Bucket: this.buckets.approved })),
      ]);
      this.logger.log(
        `S3 reachable (quarantine=${this.buckets.quarantine} approved=${this.buckets.approved})`,
      );
    } catch (err) {
      this.logger.error(
        `S3 not reachable: ${(err as Error).message}. KYC uploads will fail until storage is up.`,
      );
    }
  }

  async putObject(
    bucket: 'quarantine' | 'approved' | 'invoices',
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.buckets[bucket],
        Key: key,
        Body: body,
        ContentType: contentType,
        // SSE-S3 with a KMS-managed key would go here in Phase 2
      }),
    );
  }

  async getObject(
    bucket: 'quarantine' | 'approved' | 'invoices',
    key: string,
  ): Promise<{ body: Readable; contentType: string; contentLength: number | null }> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.buckets[bucket], Key: key }),
    );
    if (!res.Body) throw new Error('Empty object body');
    return {
      body: res.Body as Readable,
      contentType: res.ContentType ?? 'application/octet-stream',
      contentLength: res.ContentLength ?? null,
    };
  }

  async copyObject(
    fromBucket: 'quarantine' | 'approved',
    fromKey: string,
    toBucket: 'quarantine' | 'approved',
    toKey: string,
  ): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.buckets[toBucket],
        CopySource: `${this.buckets[fromBucket]}/${encodeURIComponent(fromKey)}`,
        Key: toKey,
      }),
    );
  }

  async deleteObject(
    bucket: 'quarantine' | 'approved',
    key: string,
  ): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.buckets[bucket], Key: key }),
    );
  }

  /**
   * Returns a short-lived URL the caller can hit directly. On MinIO this
   * is a full S3 pre-signed URL that bypasses our API entirely — the
   * exact same shape Cloudflare R2 and S3 return. In Phase 1 we still
   * gate access through the API for KYC (see signedUrl config), but the
   * method exists so invoice PDFs can use direct URLs immediately.
   */
  async presignGet(
    bucket: 'quarantine' | 'approved' | 'invoices',
    key: string,
    ttlSeconds: number,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.buckets[bucket], Key: key }),
      { expiresIn: ttlSeconds },
    );
  }

  getBucketName(bucket: 'quarantine' | 'approved' | 'invoices'): string {
    return this.buckets[bucket];
  }
}
