import {
  Injectable, NotFoundException, ForbiddenException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Invoice, InvoiceStatus } from '../../database/entities/invoice.entity';
import { Subscription } from '../../database/entities/subscription.entity';
import { Plan } from '../../database/entities/plan.entity';
import { Account } from '../../database/entities/account.entity';

export interface GenerateInvoiceResult {
  invoice: InvoiceResponse;
  created: boolean;
}

export interface InvoiceResponse {
  id: string;
  invoiceNumber: string;
  amount: number;
  vatAmount: number;
  tscAmount: number;
  totalAmount: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueDate: string;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  planName: string;
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  async listForCustomer(customerId: string): Promise<InvoiceResponse[]> {
    const accounts = await this.accountRepo.find({ where: { customerId } });
    if (accounts.length === 0) return [];
    const accountIds = accounts.map((a) => a.id);

    const invoices = await this.invoiceRepo
      .createQueryBuilder('i')
      .where('i.account_id IN (:...accountIds)', { accountIds })
      .orderBy('i.issued_at', 'DESC')
      .limit(50)
      .getMany();

    return Promise.all(invoices.map((inv) => this.toResponse(inv)));
  }

  async getForCustomer(customerId: string, invoiceId: string): Promise<InvoiceResponse> {
    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const account = await this.accountRepo.findOne({ where: { id: invoice.accountId } });
    if (!account || account.customerId !== customerId) {
      throw new ForbiddenException('Invoice does not belong to you');
    }

    return this.toResponse(invoice);
  }

  async generateCurrentForCustomer(
    customerId: string,
  ): Promise<GenerateInvoiceResult> {
    const accounts = await this.accountRepo.find({ where: { customerId } });
    if (accounts.length === 0) {
      throw new NotFoundException('No account found');
    }
    const accountIds = accounts.map((a) => a.id);

    const subscription = await this.subscriptionRepo
      .createQueryBuilder('s')
      .where('s.account_id IN (:...accountIds)', { accountIds })
      .orderBy(`CASE WHEN s.status = 'active' THEN 0 ELSE 1 END`, 'ASC')
      .addOrderBy('s.validity_end', 'DESC')
      .getOne();

    if (!subscription) throw new NotFoundException('No subscription found');

    const existing = await this.invoiceRepo.findOne({
      where: {
        subscriptionId: subscription.id,
        status: InvoiceStatus.ISSUED,
      },
      order: { issuedAt: 'DESC' },
    });
    if (existing) return { invoice: await this.toResponse(existing), created: false };

    const plan = await this.planRepo.findOne({ where: { id: subscription.planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    const base = Number(plan.basePrice);
    const vat = +(base * (Number(plan.vatRate) / 100)).toFixed(2);
    const tsc = +(base * (Number(plan.tscRate) / 100)).toFixed(2);
    const total = +(base + vat + tsc).toFixed(2);

    const periodStart = new Date(subscription.validityEnd);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 30);

    const invoice = this.invoiceRepo.create({
      accountId: subscription.accountId,
      subscriptionId: subscription.id,
      invoiceNumber: await this.nextInvoiceNumber(),
      amount: base,
      vatAmount: vat,
      tscAmount: tsc,
      totalAmount: total,
      status: InvoiceStatus.ISSUED,
      issuedAt: new Date(),
      dueDate: periodStart,
      notes: `Billing period ${this.toDateStr(periodStart)} – ${this.toDateStr(periodEnd)}`,
      periodStart,
      periodEnd,
    });

    try {
      const saved = await this.invoiceRepo.save(invoice);
      this.logger.log(`Invoice generated: ${saved.invoiceNumber} for subscription ${subscription.id}`);
      return { invoice: await this.toResponse(saved), created: true };
    } catch (err) {
      // Race: another request created the issued invoice first.
      // Unique index uniq_issued_invoice_per_subscription caught it — re-fetch.
      const code = (err as { code?: string }).code;
      if (code === '23505') {
        const concurrent = await this.invoiceRepo.findOne({
          where: { subscriptionId: subscription.id, status: InvoiceStatus.ISSUED },
          order: { issuedAt: 'DESC' },
        });
        if (concurrent) return { invoice: await this.toResponse(concurrent), created: false };
      }
      throw err;
    }
  }

  async getRawForCustomer(customerId: string, invoiceId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const account = await this.accountRepo.findOne({ where: { id: invoice.accountId } });
    if (!account || account.customerId !== customerId) {
      throw new ForbiddenException('Invoice does not belong to you');
    }
    return invoice;
  }

  // ------------------------------------------------------------------

  private async nextInvoiceNumber(): Promise<string> {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    for (let i = 0; i < 5; i++) {
      const rand = randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
      const candidate = `INV-${ym}-${rand}`;
      const exists = await this.invoiceRepo.exist({ where: { invoiceNumber: candidate } });
      if (!exists) return candidate;
    }
    throw new Error('Could not generate unique invoice number');
  }

  private async toResponse(inv: Invoice): Promise<InvoiceResponse> {
    const plan = inv.subscriptionId
      ? await this.subscriptionRepo.findOne({ where: { id: inv.subscriptionId } })
      : null;
    const planRow = plan ? await this.planRepo.findOne({ where: { id: plan.planId } }) : null;

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount: Number(inv.amount),
      vatAmount: Number(inv.vatAmount),
      tscAmount: Number(inv.tscAmount),
      totalAmount: Number(inv.totalAmount),
      status: inv.status,
      issuedAt: inv.issuedAt.toISOString(),
      dueDate: this.toDateStr(inv.dueDate),
      paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
      periodStart: inv.periodStart ? this.toDateStr(inv.periodStart) : null,
      periodEnd: inv.periodEnd ? this.toDateStr(inv.periodEnd) : null,
      planName: planRow?.name ?? 'Plan',
    };
  }

  private toDateStr(d: Date | string): string {
    if (typeof d === 'string') return d.slice(0, 10);
    return d.toISOString().slice(0, 10);
  }
}
