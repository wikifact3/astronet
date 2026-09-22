import {
  Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, In } from 'typeorm';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
} from '../../database/entities/ticket.entity';
import { TicketMessage, TicketMessageAuthorType } from '../../database/entities/ticket-message.entity';
import { MetricsService } from '../metrics/metrics.service';
import { Account } from '../../database/entities/account.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { AddTicketMessageDto } from './dto/add-message.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';

export interface TicketSummary {
  id: string;
  ticketNumber: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: string;
  subject: string;
  createdAt: string;
  resolvedAt: string | null;
  reopenDeadline: string | null;
  reopenedCount: number;
  messageCount: number;
}

export interface TicketDetail extends TicketSummary {
  description: string;
  messages: Array<{
    id: string;
    authorType: string;
    authorName: string;
    message: string;
    createdAt: string;
  }>;
}

const REOPEN_WINDOW_DAYS = 7;

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketMessage)
    private readonly messageRepo: Repository<TicketMessage>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    private readonly dataSource: DataSource,
    private readonly metrics: MetricsService,
  ) {}

  async list(
    customerId: string,
    query: ListTicketsQueryDto,
  ): Promise<{ tickets: TicketSummary[]; total: number }> {
    const accountIds = await this.accountIdsFor(customerId);
    if (accountIds.length === 0) return { tickets: [], total: 0 };

    const qb = this.ticketRepo
      .createQueryBuilder('t')
      .where('t.account_id IN (:...accountIds)', { accountIds })
      .orderBy('t.created_at', 'DESC')
      .limit(query.limit ?? 20)
      .offset((query.page ?? 0) * (query.limit ?? 20));

    if (query.status) qb.andWhere('t.status = :status', { status: query.status });
    if (query.category) qb.andWhere('t.category = :cat', { cat: query.category });

    const [tickets, total] = await qb.getManyAndCount();
    const summaries = await Promise.all(tickets.map((t) => this.toSummary(t)));
    return { tickets: summaries, total };
  }

  async get(customerId: string, ticketId: string): Promise<TicketDetail> {
    const ticket = await this.loadAuthorized(customerId, ticketId);
    const messages = await this.messageRepo.find({
      where: { ticketId: ticket.id, isInternal: false },
      order: { createdAt: 'ASC' },
    });

    const base = await this.toSummary(ticket);
    return {
      ...base,
      description: ticket.description,
      messages: messages.map((m) => ({
        id: m.id,
        authorType: m.authorType,
        authorName: m.authorType === 'staff' ? 'PowerLink Support' : 'You',
        message: m.message,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  async create(
    customerId: string,
    dto: CreateTicketDto,
  ): Promise<TicketDetail> {
    const account = await this.pickPrimaryAccount(customerId);

    // Inherit the ward from the account's installation address so the
    // NOC dispatch board can group tickets by ward without asking the
    // customer again.
    const installationAddress = account.installationAddress as
      | { ward?: string }
      | null;
    const ward = installationAddress?.ward ?? null;

    const ticket = await this.dataSource.transaction(async (manager) => {
      const created = manager.create(Ticket, {
        accountId: account.id,
        category: dto.category,
        status: TicketStatus.OPEN,
        priority: 'medium',
        subject: dto.subject,
        description: dto.description,
        reopenedCount: 0,
        ward,
      });
      const saved = await manager.save(created);

      // Seed the first message so the detail view is never empty
      const firstMessage = manager.create(TicketMessage, {
        ticketId: saved.id,
        authorId: customerId,
        authorType: TicketMessageAuthorType.CUSTOMER,
        message: dto.firstMessage?.trim() || dto.description,
        isInternal: false,
        attachments: [],
      });
      await manager.save(firstMessage);

      return saved;
    });

    this.metrics.ticketsCreatedTotal.inc({ category: ticket.category });
    this.logger.log(
      `Ticket created: id=${ticket.id} category=${ticket.category} account=${account.id}`,
    );
    return this.get(customerId, ticket.id);
  }

  async addMessage(
    customerId: string,
    ticketId: string,
    dto: AddTicketMessageDto,
  ): Promise<TicketDetail> {
    const ticket = await this.loadAuthorized(customerId, ticketId);

    // Block messages on closed tickets; resolved tickets accept messages
    // only while the reopen window is open
    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException(
        'This ticket is closed. Open a new ticket for further assistance.',
      );
    }

    await this.messageRepo.save(
      this.messageRepo.create({
        ticketId: ticket.id,
        authorId: customerId,
        authorType: TicketMessageAuthorType.CUSTOMER,
        message: dto.message,
        isInternal: false,
        attachments: [],
      }),
    );

    // If the ticket was resolved, a customer reply reopens the conversation
    if (ticket.status === TicketStatus.RESOLVED) {
      if (!ticket.reopenDeadline || ticket.reopenDeadline < new Date()) {
        throw new BadRequestException('Reopen window has expired.');
      }
      ticket.status = TicketStatus.REOPENED;
      ticket.reopenedCount = (ticket.reopenedCount ?? 0) + 1;
      ticket.resolvedAt = null;
      ticket.reopenDeadline = null;
      await this.ticketRepo.save(ticket);
      this.logger.log(`Ticket ${ticket.id} auto-reopened by customer reply`);
    } else if (ticket.status === TicketStatus.PENDING_CUSTOMER) {
      // Customer replied — put it back in the queue
      ticket.status = TicketStatus.OPEN;
      await this.ticketRepo.save(ticket);
    }

    return this.get(customerId, ticket.id);
  }

  async reopen(customerId: string, ticketId: string): Promise<TicketDetail> {
    const ticket = await this.loadAuthorized(customerId, ticketId);

    if (ticket.status !== TicketStatus.RESOLVED) {
      throw new BadRequestException(
        `Only resolved tickets can be reopened (current: ${ticket.status})`,
      );
    }

    if (!ticket.reopenDeadline || ticket.reopenDeadline < new Date()) {
      throw new BadRequestException(
        'Reopen window has expired. Please open a new ticket.',
      );
    }

    ticket.status = TicketStatus.REOPENED;
    ticket.reopenedCount = (ticket.reopenedCount ?? 0) + 1;
    ticket.resolvedAt = null;
    ticket.reopenDeadline = null;

    await this.ticketRepo.save(ticket);
    this.logger.log(`Ticket ${ticket.id} reopened (count=${ticket.reopenedCount})`);
    return this.get(customerId, ticket.id);
  }

  // ------------------------------------------------------------------

  private async accountIdsFor(customerId: string): Promise<string[]> {
    const accounts = await this.accountRepo.find({
      where: { customerId },
      select: ['id'],
    });
    return accounts.map((a) => a.id);
  }

  private async pickPrimaryAccount(customerId: string): Promise<Account> {
    const accounts = await this.accountRepo.find({
      where: { customerId },
      order: { createdAt: 'ASC' },
    });
    if (accounts.length === 0) {
      throw new NotFoundException(
        'No account found for this customer. Apply for a new connection first.',
      );
    }
    return accounts[0];
  }

  private async loadAuthorized(customerId: string, ticketId: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const account = await this.accountRepo.findOne({ where: { id: ticket.accountId } });
    if (!account || account.customerId !== customerId) {
      throw new ForbiddenException('Ticket does not belong to you');
    }
    return ticket;
  }

  private async toSummary(t: Ticket): Promise<TicketSummary> {
    const messageCount = await this.messageRepo.count({
      where: { ticketId: t.id, isInternal: false },
    });

    return {
      id: t.id,
      ticketNumber: this.ticketNumber(t),
      category: t.category,
      status: t.status,
      priority: t.priority,
      subject: t.subject,
      createdAt: t.createdAt.toISOString(),
      resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
      reopenDeadline: t.reopenDeadline ? t.reopenDeadline.toISOString() : null,
      reopenedCount: t.reopenedCount ?? 0,
      messageCount,
    };
  }

  /**
   * Ticket IDs are UUIDs. Derive a short human-readable display number
   * from the UUID so the customer sees something stable and short.
   */
  private ticketNumber(t: Ticket): string {
    const short = t.id.replace(/-/g, '').slice(0, 6).toUpperCase();
    const y = new Date(t.createdAt).getFullYear();
    return `TKT-${y}-${short}`;
  }
}
