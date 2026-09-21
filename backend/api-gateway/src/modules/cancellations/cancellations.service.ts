import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  CancellationRequest,
  CancellationRequestStatus,
} from '../../database/entities/cancellation-request.entity';
import { Account } from '../../database/entities/account.entity';
import { Subscription } from '../../database/entities/subscription.entity';

export interface CancellationResponse {
  id: string;
  status: CancellationRequestStatus;
  reason: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

@Injectable()
export class CancellationsService {
  private readonly logger = new Logger(CancellationsService.name);

  constructor(
    @InjectRepository(CancellationRequest)
    private readonly requestRepo: Repository<CancellationRequest>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  async listForCustomer(customerId: string): Promise<CancellationResponse[]> {
    const accounts = await this.accountRepo.find({ where: { customerId } });
    if (accounts.length === 0) return [];
    const ids = accounts.map((a) => a.id);

    const rows = await this.requestRepo.find({
      where: { accountId: In(ids) },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.toResponse(r));
  }

  async createForCustomer(
    customerId: string,
    reason: string,
  ): Promise<CancellationResponse> {
    const accounts = await this.accountRepo.find({
      where: { customerId },
      order: { createdAt: 'ASC' },
    });
    if (accounts.length === 0) throw new NotFoundException('No account found');
    const account = accounts[0];

    // Reject if there's already a pending request for this account
    const existing = await this.requestRepo.findOne({
      where: {
        accountId: account.id,
        status: CancellationRequestStatus.PENDING,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'You already have a pending cancellation request. Our team will contact you.',
      );
    }

    const sub = await this.subscriptionRepo.findOne({
      where: { accountId: account.id },
      order: { validityEnd: 'DESC' },
    });

    const req = this.requestRepo.create({
      accountId: account.id,
      subscriptionId: sub?.id ?? null,
      reason,
      status: CancellationRequestStatus.PENDING,
    });
    const saved = await this.requestRepo.save(req);

    this.logger.log(
      `Cancellation request created: account=${account.id} request=${saved.id}`,
    );
    return this.toResponse(saved);
  }

  async withdraw(customerId: string, id: string): Promise<CancellationResponse> {
    const req = await this.requestRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');

    const account = await this.accountRepo.findOne({ where: { id: req.accountId } });
    if (!account || account.customerId !== customerId) {
      throw new NotFoundException('Request not found');
    }

    if (req.status !== CancellationRequestStatus.PENDING) {
      throw new BadRequestException(`Cannot withdraw a ${req.status} request`);
    }

    req.status = CancellationRequestStatus.WITHDRAWN;
    await this.requestRepo.save(req);
    return this.toResponse(req);
  }

  private toResponse(r: CancellationRequest): CancellationResponse {
    return {
      id: r.id,
      status: r.status,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      reviewNotes: r.reviewNotes,
    };
  }
}
