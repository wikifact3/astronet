import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  KycDocument, KycStatus, KycPipelineStatus,
} from '../../database/entities/kyc-document.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Account } from '../../database/entities/account.entity';
import { S3Service } from '../storage/s3.service';
import { SmsService } from '../sms/sms.service';
import { AuditService } from '../audit/audit.service';
import { SmsCategory } from '../../database/entities/sms-log.entity';
import { KycReviewAction, ReviewKycDto } from './dto/review-kyc.dto';

export interface KycQueueItem {
  id: string;
  accountId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  documentType: string;
  status: KycStatus;
  pipelineStatus: KycPipelineStatus;
  mimeType: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
  reviewedAt: string | null;
  scanResult: string | null;
}

export interface KycDetail extends KycQueueItem {
  storageKey: string | null;
  reviewReasonCode: string | null;
  reviewNotes: string | null;
  reviewedBy: string | null;
}

export interface SignedFileUrl {
  url: string;
  expiresAt: string;
  mimeType: string | null;
}

@Injectable()
export class AdminKycService {
  private readonly logger = new Logger(AdminKycService.name);

  constructor(
    @InjectRepository(KycDocument)
    private readonly kycRepo: Repository<KycDocument>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly s3: S3Service,
    private readonly configService: ConfigService,
    private readonly jwt: JwtService,
    private readonly sms: SmsService,
    private readonly audit: AuditService,
  ) {}

  async list(status?: KycStatus): Promise<KycQueueItem[]> {
    const qb = this.kycRepo
      .createQueryBuilder('k')
      .orderBy(
        `CASE WHEN k.status = 'pending' AND k.pipeline_status = 'verified' THEN 0 ELSE 1 END`,
        'ASC',
      )
      .addOrderBy('k.created_at', 'DESC')
      .limit(100);

    if (status) qb.where('k.status = :status', { status });

    const docs = await qb.getMany();
    return Promise.all(docs.map((d) => this.toQueueItem(d)));
  }

  async get(id: string): Promise<KycDetail> {
    const doc = await this.kycRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('KYC document not found');

    const base = await this.toQueueItem(doc);
    return {
      ...base,
      storageKey: doc.storageKey,
      reviewReasonCode: doc.reviewReasonCode,
      reviewNotes: doc.reviewNotes,
      reviewedBy: doc.reviewedBy,
    };
  }

  async review(
    id: string,
    staffId: string,
    dto: ReviewKycDto,
  ): Promise<KycDetail> {
    const doc = await this.kycRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('KYC document not found');

    if (doc.status !== KycStatus.PENDING) {
      throw new BadRequestException(
        `Document already reviewed (status=${doc.status})`,
      );
    }

    if (doc.pipelineStatus !== KycPipelineStatus.VERIFIED) {
      throw new BadRequestException(
        `Document is not ready for review (pipeline=${doc.pipelineStatus})`,
      );
    }

    doc.status =
      dto.action === KycReviewAction.APPROVE
        ? KycStatus.APPROVED
        : KycStatus.REJECTED;
    doc.reviewReasonCode = dto.reasonCode;
    doc.reviewNotes = dto.notes ?? null;
    doc.reviewedBy = staffId;
    doc.reviewedAt = new Date();

    await this.kycRepo.save(doc);
    await this.audit.record({
      actorId: staffId,
      actorType: 'staff',
      action: `kyc.${dto.action}`,
      resourceType: 'kyc_document',
      resourceId: doc.id,
      metadata: {
        reasonCode: dto.reasonCode,
        notes: dto.notes ?? null,
      },
    });
    this.logger.log(
      `KYC ${doc.id} reviewed by ${staffId}: ${dto.action} (${dto.reasonCode})`,
    );

    const account = await this.accountRepo.findOne({ where: { id: doc.accountId } });
    if (account) {
      const customer = await this.customerRepo.findOne({
        where: { id: account.customerId },
      });
      if (customer) {
        customer.kycStatus =
          doc.status === KycStatus.APPROVED
            ? ('approved' as never)
            : ('rejected' as never);
        await this.customerRepo.save(customer);
      }
    }

    return this.get(id);
  }

  async signedUrl(id: string): Promise<SignedFileUrl> {
    const doc = await this.kycRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('KYC document not found');

    const key = doc.storageKey ?? doc.quarantineKey;
    if (!key) throw new BadRequestException('Document has no stored file');

    const bucket: 'approved' | 'quarantine' = doc.storageKey ? 'approved' : 'quarantine';
    const ttl = this.configService.get<number>('kyc.signedUrlTtlSeconds', 300);
    const url = await this.s3.presignGet(bucket, key, ttl);

    return {
      url,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      mimeType: doc.mimeType,
    };
  }

  /**
   * Streams the KYC file bytes through the API. Used when the object
   * store's public endpoint isn't reachable from the browser — Codespaces
   * port forwarding rewrites the Host header, which breaks SigV4 on
   * presigned URLs. The API has no such problem: it talks to MinIO over
   * the internal Docker network using the endpoint the signature was
   * computed for.
   */
  async streamFile(id: string, res: Response): Promise<void> {
    const doc = await this.kycRepo.findOne({ where: { id } });
    if (!doc) {
      res.status(404).send('Document not found');
      return;
    }

    const key = doc.storageKey ?? doc.quarantineKey;
    if (!key) {
      res.status(404).send('No file stored for this document');
      return;
    }

    const bucket: 'approved' | 'quarantine' = doc.storageKey
      ? 'approved'
      : 'quarantine';

    try {
      const { body } = await this.s3.getObject(bucket, key);

      res.setHeader('Content-Type', doc.mimeType ?? 'application/octet-stream');
      if (doc.fileSizeBytes) {
        res.setHeader('Content-Length', doc.fileSizeBytes);
      }
      res.setHeader('Cache-Control', 'private, max-age=60, must-revalidate');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      body.pipe(res);
    } catch (err) {
      this.logger.error(
        `streamFile failed for doc=${id}: ${(err as Error).message}`,
      );
      res.status(500).send('Failed to read document');
    }
  }

  private async toQueueItem(doc: KycDocument): Promise<KycQueueItem> {
    const account = await this.accountRepo.findOne({ where: { id: doc.accountId } });
    const customer = account
      ? await this.customerRepo.findOne({ where: { id: account.customerId } })
      : null;

    return {
      id: doc.id,
      accountId: doc.accountId,
      customerId: account?.customerId ?? '',
      customerName: customer?.fullName ?? '(unknown)',
      customerPhone: customer?.phone ?? '',
      documentType: doc.documentType,
      status: doc.status,
      pipelineStatus: doc.pipelineStatus,
      mimeType: doc.mimeType,
      fileSizeBytes: doc.fileSizeBytes ? parseInt(doc.fileSizeBytes, 10) : null,
      createdAt: doc.createdAt.toISOString(),
      reviewedAt: doc.reviewedAt ? doc.reviewedAt.toISOString() : null,
      scanResult: doc.scanResult,
    };
  }
}
