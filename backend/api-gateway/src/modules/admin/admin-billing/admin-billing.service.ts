import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { randomBytes } from 'crypto';
import { Invoice, InvoiceStatus } from '../../../database/entities/invoice.entity';
import { Account } from '../../../database/entities/account.entity';
import { Customer } from '../../../database/entities/customer.entity';
import { Subscription } from '../../../database/entities/subscription.entity';
import { Plan } from '../../../database/entities/plan.entity';
import { Payment, PaymentStatus } from '../../../database/entities/payment.entity';
import { AuditService } from '../../audit/audit.service';
import {
  ListAdminInvoicesDto,
} from './dto/list-invoices.dto';
import {
  AdjustmentKind,
  ManualAdjustmentDto,
} from './dto/manual-adjustment.dto';

export interface AdminInvoiceRow {
  id: string;
  invoiceNumber: string;
  accountId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  vatAmount: number;
  tscAmount: number;
  totalAmount: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueDate: string;
  paidAt: string | null;
  isAdjustment: boolean;
  originalInvoiceId: string | null;
}

export interface ReconciliationSummary {
  period: { from: string | null; to: string | null };
  counts: {
    issued: number;
    paid: number;
    overdue: number;
    cancelled: number;
    creditNote: number;
  };
  amounts: {
    outstanding: number;
    collected: number;
    credits: number;
    overdue: number;
  };
}

export interface ManualAdjustmentResult {
  invoiceId: string;
  invoiceNumber: string;
  kind: AdjustmentKind;
  amount: number;
  linkedTo: string | null;
}

@Injectable()
export class AdminBillingService {
  private readonly logger = new Logger(AdminBillingService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async listInvoices(
    query: ListAdminInvoicesDto,
  ): Promise<{ invoices: AdminInvoiceRow[]; total: number; summary: ReconciliationSummary }> {
    const qb = this.invoiceRepo
      .createQueryBuilder('i')
      .orderBy('i.issued_at', 'DESC')
      .limit(query.limit ?? 50)
      .offset((query.page ?? 0) * (query.limit ?? 50));

    if (query.status) {
      qb.andWhere('i.status = :status', { status: query.status });
    }
    if (query.fromDate) {
      qb.andWhere('i.issued_at >= :from', { from: query.fromDate });
    }
    if (query.toDate) {
      qb.andWhere('i.issued_at <= :to', { to: `${query.toDate}T23:59:59Z` });
    }

    if (query.search) {
      const term = `%${query.search.trim()}%`;
      // Search by invoice number OR customer name/phone
      qb.leftJoin(Account, 'a', 'a.id = i.account_id')
        .leftJoin(Customer, 'c', 'c.id = a.customer_id')
        .andWhere(
          '(i.invoice_number ILIKE :term OR c.full_name ILIKE :term OR c.phone ILIKE :term)',
          { term },
        );
    }

    const [invoices, total] = await qb.getManyAndCount();
    const rows = await Promise.all(invoices.map((i) => this.toRow(i)));
    const summary = await this.summaryFor(query.fromDate, query.toDate);

    return { invoices: rows, total, summary };
  }

  async getInvoice(id: string): Promise<AdminInvoiceRow> {
    const invoice = await this.invoiceRepo.findOne({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.toRow(invoice);
  }

  /**
   * Records a manual adjustment as a NEW invoice linked to the original.
   * The original is never mutated — this preserves the append-only
   * semantics of the invoices table and keeps the audit trail intact.
   *
   * CHARGE: a positive invoice billed to the account (e.g., a late fee).
   * CREDIT: a credit-note invoice that reduces the amount owed.
   * REFUND: a credit-note invoice that offsets a specific paid invoice.
   */
  async adjust(
    staffId: string,
    dto: ManualAdjustmentDto,
    ctx: { ip: string | null; userAgent: string | null },
  ): Promise<ManualAdjustmentResult> {
    const account = await this.accountRepo.findOne({ where: { id: dto.accountId } });
    if (!account) throw new NotFoundException('Account not found');

    let originalInvoice: Invoice | null = null;
    if (dto.originalInvoiceId) {
      originalInvoice = await this.invoiceRepo.findOne({
        where: { id: dto.originalInvoiceId },
      });
      if (!originalInvoice) throw new NotFoundException('Original invoice not found');
      if (originalInvoice.accountId !== account.id) {
        throw new BadRequestException(
          'Original invoice does not belong to this account',
        );
      }
    }

    if (dto.kind === AdjustmentKind.REFUND && !originalInvoice) {
      throw new BadRequestException('Refund requires an original invoice');
    }

    if (dto.kind === AdjustmentKind.REFUND && originalInvoice?.status !== InvoiceStatus.PAID) {
      throw new BadRequestException('Can only refund a paid invoice');
    }

    const amount = +dto.amount.toFixed(2);
    const total = amount; // manual adjustments are VAT-inclusive for simplicity
    const isCredit = dto.kind !== AdjustmentKind.CHARGE;

    const subscription = await this.subscriptionRepo.findOne({
      where: { accountId: account.id },
      order: { validityEnd: 'DESC' },
    });

    const created = await this.dataSource.transaction(async (manager) => {
      const invoice = manager.create(Invoice, {
        accountId: account.id,
        subscriptionId:
          originalInvoice?.subscriptionId ?? subscription?.id ?? null as never,
        invoiceNumber: await this.nextInvoiceNumber(),
        amount: isCredit ? -amount : amount,
        vatAmount: 0,
        tscAmount: 0,
        totalAmount: isCredit ? -total : total,
        status: isCredit ? InvoiceStatus.CREDIT_NOTE : InvoiceStatus.ISSUED,
        issuedAt: new Date(),
        dueDate: new Date(),
        notes: `[${dto.kind.toUpperCase()}] ${dto.reason}`,
        originalInvoiceId: originalInvoice?.id ?? null,
      });
      const saved = await manager.save(invoice);

      await this.audit.record({
        actorId: staffId,
        actorType: 'staff',
        action: `billing.${dto.kind}`,
        resourceType: 'invoice',
        resourceId: saved.id,
        metadata: {
          kind: dto.kind,
          amount,
          reason: dto.reason,
          accountId: account.id,
          originalInvoiceId: originalInvoice?.id ?? null,
        },
        ipAddress: ctx.ip ?? undefined,
        userAgent: ctx.userAgent ?? undefined,
      });

      return saved;
    });

    this.logger.log(
      `Manual adjustment: kind=${dto.kind} amount=${amount} account=${account.id} invoice=${created.invoiceNumber} by staff=${staffId}`,
    );

    return {
      invoiceId: created.id,
      invoiceNumber: created.invoiceNumber,
      kind: dto.kind,
      amount,
      linkedTo: originalInvoice?.invoiceNumber ?? null,
    };
  }

  // ------------------------------------------------------------------

  private async summaryFor(
    from?: string,
    to?: string,
  ): Promise<ReconciliationSummary> {
    const qb = this.invoiceRepo.createQueryBuilder('i');

    if (from) qb.andWhere('i.issued_at >= :from', { from });
    if (to) qb.andWhere('i.issued_at <= :to', { to: `${to}T23:59:59Z` });

    const rows = await qb
      .select('i.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('COALESCE(SUM(i.total_amount), 0)::numeric', 'sum')
      .groupBy('i.status')
      .getRawMany<{ status: InvoiceStatus; count: number; sum: string }>();

    const byStatus: Record<string, { count: number; sum: number }> = {};
    for (const r of rows) {
      byStatus[r.status] = { count: Number(r.count), sum: Number(r.sum) };
    }

    const issued = byStatus[InvoiceStatus.ISSUED] ?? { count: 0, sum: 0 };
    const paid = byStatus[InvoiceStatus.PAID] ?? { count: 0, sum: 0 };
    const overdue = byStatus[InvoiceStatus.OVERDUE] ?? { count: 0, sum: 0 };
    const cancelled = byStatus[InvoiceStatus.CANCELLED] ?? { count: 0, sum: 0 };
    const creditNote = byStatus[InvoiceStatus.CREDIT_NOTE] ?? { count: 0, sum: 0 };

    return {
      period: { from: from ?? null, to: to ?? null },
      counts: {
        issued: issued.count,
        paid: paid.count,
        overdue: overdue.count,
        cancelled: cancelled.count,
        creditNote: creditNote.count,
      },
      amounts: {
        outstanding: issued.sum + overdue.sum,
        collected: paid.sum,
        credits: Math.abs(creditNote.sum),
        overdue: overdue.sum,
      },
    };
  }

  private async toRow(inv: Invoice): Promise<AdminInvoiceRow> {
    const account = await this.accountRepo.findOne({ where: { id: inv.accountId } });
    const customer = account
      ? await this.customerRepo.findOne({ where: { id: account.customerId } })
      : null;

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      accountId: inv.accountId,
      customerId: account?.customerId ?? '',
      customerName: customer?.fullName ?? '(unknown)',
      customerPhone: customer?.phone ?? '',
      amount: Number(inv.amount),
      vatAmount: Number(inv.vatAmount),
      tscAmount: Number(inv.tscAmount),
      totalAmount: Number(inv.totalAmount),
      status: inv.status,
      issuedAt: inv.issuedAt.toISOString(),
      dueDate: this.toDateStr(inv.dueDate),
      paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
      isAdjustment: inv.notes?.startsWith('[') ?? false,
      originalInvoiceId: inv.originalInvoiceId,
    };
  }

  private async nextInvoiceNumber(): Promise<string> {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    for (let i = 0; i < 5; i++) {
      const rand = randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
      const candidate = `ADJ-${ym}-${rand}`;
      const exists = await this.invoiceRepo.exist({ where: { invoiceNumber: candidate } });
      if (!exists) return candidate;
    }
    throw new Error('Could not generate unique invoice number');
  }

  private toDateStr(d: Date | string): string {
    if (typeof d === 'string') return d.slice(0, 10);
    return d.toISOString().slice(0, 10);
  }
}
