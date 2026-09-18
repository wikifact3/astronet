import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { KycDocument, KycStatus, KycPipelineStatus } from '../../database/entities/kyc-document.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Account } from '../../database/entities/account.entity';
import { S3Service } from '../storage/s3.service';
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
    this.logger.log(
      `KYC ${doc.id} reviewed by ${staffId}: ${dto.action} (${dto.reasonCode})`,
    );

    // Cascade: update customer kyc_status
    const account = await this.accountRepo.findOne({ where: { id: doc.accountId } });
    if (account) {
      const customer = await this.customerRepo.findOne({ where: { id: account.customerId } });
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

  /**
   * Returns a short-lived presigned URL the admin's browser can hit
   * directly. MinIO issues a real S3 presign; when we migrate to R2 or
   * S3, this method's behavior is identical.
   */
  async signedUrl(id: string): Promise<SignedFileUrl> {
    const doc = await this.kycRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('KYC document not found');

    const key = doc.storageKey ?? doc.quarantineKey;
    if (!key) {
      throw new BadRequestException('Document has no stored file');
    }

    const bucket: 'approved' | 'quarantine' = doc.storageKey ? 'approved' : 'quarantine';
    const ttl = this.configService.get<number>('kyc.signedUrlTtlSeconds', 300);
    const url = await this.s3.presignGet(bucket, key, ttl);

    return {
      url,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      mimeType: doc.mimeType,
    };
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
