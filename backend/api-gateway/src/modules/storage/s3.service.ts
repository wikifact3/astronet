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
  private readonly internalClient: S3Client;
  private readonly publicClient: S3Client;
  private readonly buckets: { quarantine: string; approved: string; invoices: string };

  constructor(private readonly configService: ConfigService) {
    const cfg = this.configService.get('storage.s3') as {
      endpoint: string;
      region: string;
      accessKey: string;
      secretKey: string;
      forcePathStyle: boolean;
    };
    const publicEndpoint = this.configService.get<string>('storage.publicEndpoint')!;

    const credentials = {
      accessKeyId: cfg.accessKey,
      secretAccessKey: cfg.secretKey,
    };

    // Internal client: used for server-to-server operations (put/copy/delete).
    // Talks to MinIO over the Docker network or localhost.
    this.internalClient = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      credentials,
      forcePathStyle: cfg.forcePathStyle,
    });

    // Public client: used ONLY for signing URLs that a browser will fetch.
    // The host component of a presigned URL is part of the signature, so
    // it must match what the browser actually connects to.
    this.publicClient = new S3Client({
      endpoint: publicEndpoint,
      region: cfg.region,
      credentials,
      forcePathStyle: cfg.forcePathStyle,
    });

    this.buckets =
      (this.configService.get('storage.buckets') as typeof this.buckets) ?? {
        quarantine: 'powerlink-kyc-quarantine',
        approved: 'powerlink-kyc-approved',
        invoices: 'powerlink-invoices',
      };
  }

  async onModuleInit(): Promise<void> {
    try {
      await Promise.all([
        this.internalClient.send(new HeadBucketCommand({ Bucket: this.buckets.quarantine })),
        this.internalClient.send(new HeadBucketCommand({ Bucket: this.buckets.approved })),
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
    await this.internalClient.send(
      new PutObjectCommand({
        Bucket: this.buckets[bucket],
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObject(
    bucket: 'quarantine' | 'approved' | 'invoices',
    key: string,
  ): Promise<{ body: Readable; contentType: string; contentLength: number | null }> {
    const res = await this.internalClient.send(
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
    await this.internalClient.send(
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
    await this.internalClient.send(
      new DeleteObjectCommand({ Bucket: this.buckets[bucket], Key: key }),
    );
  }

  /**
   * Signs a GET URL against the PUBLIC endpoint so a browser can fetch it.
   * Never sign with the internal client for browser-facing URLs — the host
   * is part of the signature.
   */
  async presignGet(
    bucket: 'quarantine' | 'approved' | 'invoices',
    key: string,
    ttlSeconds: number,
  ): Promise<string> {
    return getSignedUrl(
      this.publicClient,
      new GetObjectCommand({ Bucket: this.buckets[bucket], Key: key }),
      { expiresIn: ttlSeconds },
    );
  }

  getBucketName(bucket: 'quarantine' | 'approved' | 'invoices'): string {
    return this.buckets[bucket];
  }
}
