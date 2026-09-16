import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KycDocument, KycStatus } from '../../database/entities/kyc-document.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Account } from '../../database/entities/account.entity';
import {
  KycReviewAction,
  ReviewKycDto,
} from './dto/review-kyc.dto';

export interface KycQueueItem {
  id: string;
  accountId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  documentType: string;
  status: KycStatus;
  createdAt: string;
  reviewedAt: string | null;
}

export interface KycDetail extends KycQueueItem {
  encryptedFileRef: string;
  reviewReasonCode: string | null;
  reviewNotes: string | null;
  reviewedBy: string | null;
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
  ) {}

  async list(status?: KycStatus): Promise<KycQueueItem[]> {
    const qb = this.kycRepo
      .createQueryBuilder('k')
      .orderBy(
        `CASE WHEN k.status = 'pending' THEN 0 ELSE 1 END`,
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
      encryptedFileRef: doc.encryptedFileRef,
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

    // Cascade: approval moves the customer out of kyc_pending.
    // (Account status transitions land in the CRM slice — for now we
    // only flip the customer's own kyc_status so the customer sees it.)
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
      createdAt: doc.createdAt.toISOString(),
      reviewedAt: doc.reviewedAt ? doc.reviewedAt.toISOString() : null,
    };
  }
}
