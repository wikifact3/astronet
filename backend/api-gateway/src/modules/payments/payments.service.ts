import {
  Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  Payment,
  PaymentProvider as PaymentProviderEnum,
  PaymentStatus,
} from '../../database/entities/payment.entity';
import { Invoice, InvoiceStatus } from '../../database/entities/invoice.entity';
import { Subscription } from '../../database/entities/subscription.entity';
import { Account } from '../../database/entities/account.entity';
import { StubPaymentProvider } from './providers/stub.provider';
import { PaymentProvider } from './providers/payment-provider.interface';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { SmsService } from '../sms/sms.service';
import { SmsCategory } from '../../database/entities/sms-log.entity';
import { Customer } from '../../database/entities/customer.entity';

export interface InitiatePaymentResult {
  paymentId: string;
  redirectUrl: string;
  expiresAt: string;
}

export interface PaymentStatusResponse {
  paymentId: string;
  status: PaymentStatus;
  providerTxnId: string | null;
  confirmedAt: string | null;
  invoiceStatus: InvoiceStatus;
  bandwidthStatus: 'pending' | 'active' | 'failed';
}

export interface WebhookProcessResult {
  paymentId: string;
  status: PaymentStatus;
  duplicate: boolean;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly idempotency: IdempotencyService,
    private readonly stubProvider: StubPaymentProvider,
    private readonly sms: SmsService,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  private getProvider(name: string): PaymentProvider {
    const mode = this.configService.get<string>('payment.providerMode');
    if (mode === 'stub') return this.stubProvider;
    if (name === 'stub') return this.stubProvider;
    throw new BadRequestException(`Provider not configured: ${name}`);
  }

  async initiate(
    customerId: string,
    providerName: string,
    invoiceId: string,
    idempotencyKey: string | null,
  ): Promise<InitiatePaymentResult> {
    if (idempotencyKey) {
      const cached = await this.idempotency.get('payment.initiate', idempotencyKey);
      if (cached) return cached.body as InitiatePaymentResult;
    }

    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const account = await this.accountRepo.findOne({ where: { id: invoice.accountId } });
    if (!account) throw new NotFoundException('Account not found');
    if (account.customerId !== customerId) {
      throw new ForbiddenException('Invoice does not belong to you');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already paid');
    }
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Invoice is cancelled');
    }

    const provider = this.getProvider(providerName);
    const paymentId = randomUUID();

    const returnUrl = `${this.configService.get<string>('payment.portalPublicBaseUrl')}/en/renew?paymentId=${paymentId}`;
    const webhookUrl = `${this.configService.get<string>('payment.apiPublicBaseUrl')}/v1/payments/${providerName}/webhook`;

    const { redirectUrl, providerTxnId } = await provider.initiate({
      paymentId,
      amount: Number(invoice.totalAmount),
      invoiceNumber: invoice.invoiceNumber,
      customerPhone: '',
      returnUrl,
      webhookUrl,
    });

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const payment = this.paymentRepo.create({
      id: paymentId,
      invoiceId: invoice.id,
      provider: this.toProviderEnum(providerName),
      amount: Number(invoice.totalAmount),
      status: PaymentStatus.INITIATED,
      idempotencyKey: `initiate:${paymentId}`,
      providerTxnId: providerTxnId ?? null,
      initiatedAt: new Date(),
      metadata: { redirectUrl },
      redirectUrl,
      initiatedBy: customerId,
      expiresAt,
    });

    const saved = await this.paymentRepo.save(payment);

    const result: InitiatePaymentResult = {
      paymentId: saved.id,
      redirectUrl,
      expiresAt: expiresAt.toISOString(),
    };

    if (idempotencyKey) {
      await this.idempotency.store('payment.initiate', idempotencyKey, result, 200);
    }

    this.logger.log(
      `Payment initiated: id=${saved.id} invoice=${invoice.invoiceNumber} amount=${invoice.totalAmount} provider=${providerName}`,
    );

    return result;
  }

  async getStatus(customerId: string, paymentId: string): Promise<PaymentStatusResponse> {
    const payment = await this.paymentRepo.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');

    const invoice = await this.invoiceRepo.findOne({ where: { id: payment.invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const account = await this.accountRepo.findOne({ where: { id: invoice.accountId } });
    if (!account || account.customerId !== customerId) {
      throw new ForbiddenException('Payment does not belong to you');
    }

    let bandwidthStatus: PaymentStatusResponse['bandwidthStatus'] = 'pending';

    if (payment.status === PaymentStatus.CONFIRMED) {
      const sub = await this.subscriptionRepo.findOne({
        where: { id: invoice.subscriptionId },
      });
      if (sub && sub.status === 'active') {
        const end = this.parseDate(sub.validityEnd);
        const due = this.parseDate(invoice.dueDate);
        if (end > due) {
          bandwidthStatus = 'active';
        }
      }
    } else if (
      payment.status === PaymentStatus.DECLINED ||
      payment.status === PaymentStatus.FAILED
    ) {
      bandwidthStatus = 'failed';
    }

    return {
      paymentId: payment.id,
      status: payment.status,
      providerTxnId: payment.providerTxnId,
      confirmedAt: payment.confirmedAt ? payment.confirmedAt.toISOString() : null,
      invoiceStatus: invoice.status,
      bandwidthStatus,
    };
  }

  async handleWebhook(
    providerName: string,
    rawBody: string,
    signature: string | null,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<WebhookProcessResult> {
    const provider = this.getProvider(providerName);
    const event = await provider.verifyWebhook({ rawBody, signature, headers });

    this.logger.log(
      `Webhook ${providerName}: txn=${event.providerTxnId} status=${event.status}`,
    );

    const existing = await this.paymentRepo.findOne({
      where: { providerTxnId: event.providerTxnId },
    });
    if (existing && existing.status === PaymentStatus.CONFIRMED) {
      this.logger.warn(`Duplicate webhook ignored: txn=${event.providerTxnId}`);
      return {
        paymentId: existing.id,
        status: existing.status,
        duplicate: true,
      };
    }

    const paymentIdFromPayload =
      typeof event.rawPayload.paymentId === 'string'
        ? (event.rawPayload.paymentId as string)
        : null;

    const payment =
      existing ??
      (paymentIdFromPayload
        ? await this.paymentRepo.findOne({ where: { id: paymentIdFromPayload } })
        : null);

    if (!payment) {
      throw new NotFoundException(`No payment for webhook txn=${event.providerTxnId}`);
    }

    if (payment.status === PaymentStatus.CONFIRMED) {
      return { paymentId: payment.id, status: payment.status, duplicate: true };
    }

    payment.webhookPayload = event.rawPayload;
    payment.webhookReceivedAt = new Date();
    if (!payment.providerTxnId) payment.providerTxnId = event.providerTxnId;

    if (event.status === 'success') {
      payment.status = PaymentStatus.CONFIRMED;
      payment.confirmedAt = new Date();
    } else if (event.status === 'pending') {
      payment.status = PaymentStatus.PENDING_CONFIRMATION;
    } else {
      payment.status = PaymentStatus.DECLINED;
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.save(payment);

      if (payment.status !== PaymentStatus.CONFIRMED) return;

      const invoice = await manager.findOne(Invoice, { where: { id: payment.invoiceId } });
      if (!invoice) throw new NotFoundException('Invoice not found');

      const sub = await manager.findOne(Subscription, {
        where: { id: invoice.subscriptionId },
      });
      if (!sub) {
        this.logger.warn(
          `No subscription for invoice ${invoice.id} (subscriptionId=${invoice.subscriptionId})`,
        );
        return;
      }

      if (invoice.status !== InvoiceStatus.PAID) {
        invoice.status = InvoiceStatus.PAID;
        invoice.paidAt = new Date();
        await manager.save(invoice);
      }

      // Extend the subscription by one cycle from whichever is later:
      // today, or the current validity_end.
      const today = this.startOfDay(new Date());
      const currentEnd = this.parseDate(sub.validityEnd);
      const base = currentEnd > today ? currentEnd : today;
      const newEnd = new Date(base);
      newEnd.setDate(newEnd.getDate() + 30);

      const previousEnd = this.formatDate(currentEnd);
      const newEndStr = this.formatDate(newEnd);

      sub.validityEnd = newEndStr as unknown as Date;
      sub.status = 'active';
      await manager.save(sub);

      this.logger.log(
        `Subscription ${sub.id} extended: ${previousEnd} → ${newEndStr}`,
      );
    });

    this.logger.log(
      `Payment ${payment.id} → ${payment.status} (invoice=${payment.invoiceId})`,
    );

    if (payment.status === PaymentStatus.CONFIRMED) {
      await this.sendPaymentConfirmation(payment);
    }

    return {
      paymentId: payment.id,
      status: payment.status,
      duplicate: false,
    };
  }

  private async sendPaymentConfirmation(payment: Payment): Promise<void> {
    try {
      const invoice = await this.invoiceRepo.findOne({ where: { id: payment.invoiceId } });
      if (!invoice) return;

      const account = await this.accountRepo.findOne({ where: { id: invoice.accountId } });
      if (!account) return;

      const customer = await this.customerRepo.findOne({ where: { id: account.customerId } });
      if (!customer) return;

      await this.sms.dispatch(
        customer.phone,
        `PowerLink: Payment received — Rs. ${Number(payment.amount).toLocaleString('en-NP')} for invoice ${invoice.invoiceNumber}. Your connection has been renewed.`,
        SmsCategory.PAYMENT,
      );
    } catch (err) {
      this.logger.warn(
        `Payment confirmation SMS failed for payment ${payment.id}: ${(err as Error).message}`,
      );
    }
  }

  // ------------------------------------------------------------------
  // Date helpers. TypeORM returns DATE columns as strings, so always
  // normalize to local-midnight Date before comparing or arithmetic.
  // ------------------------------------------------------------------

  private parseDate(value: Date | string): Date {
    if (value instanceof Date) {
      return this.startOfDay(value);
    }
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private startOfDay(d: Date): Date {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private toProviderEnum(name: string): PaymentProviderEnum {
    const map: Record<string, PaymentProviderEnum> = {
      esewa: PaymentProviderEnum.ESEWA,
      khalti: PaymentProviderEnum.KHALTI,
      fonepay: PaymentProviderEnum.FONEPAY,
      connectips: PaymentProviderEnum.CONNECTIPS,
    };
    return map[name] ?? PaymentProviderEnum.ESEWA;
  }
}