import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketStatus } from '../../database/entities/ticket.entity';
import {
  TicketMessage, TicketMessageAuthorType,
} from '../../database/entities/ticket-message.entity';
import { Account } from '../../database/entities/account.entity';
import { Customer } from '../../database/entities/customer.entity';
import { StaffUser } from '../../database/entities/staff-user.entity';
import { Role } from '../../database/entities/role.entity';
import { SmsService } from '../sms/sms.service';
import { AuditService } from '../audit/audit.service';
import { SmsCategory } from '../../database/entities/sms-log.entity';
import { ListAdminTicketsQueryDto } from './dto/list-tickets.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { StaffReplyDto } from './dto/staff-reply.dto';

export interface AdminTicketSummary {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  status: TicketStatus;
  priority: string;
  customerName: string;
  customerPhone: string;
  assignedToId: string | null;
  assignedToName: string | null;
  ward: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface AdminTicketDetail extends AdminTicketSummary {
  description: string;
  messages: Array<{
    id: string;
    authorType: string;
    authorName: string;
    message: string;
    isInternal: boolean;
    createdAt: string;
  }>;
}

@Injectable()
export class AdminTicketsService {
  private readonly logger = new Logger(AdminTicketsService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketMessage)
    private readonly messageRepo: Repository<TicketMessage>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly sms: SmsService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: ListAdminTicketsQueryDto,
  ): Promise<{ tickets: AdminTicketSummary[]; total: number }> {
    const qb = this.ticketRepo
      .createQueryBuilder('t')
      .orderBy(
        `CASE WHEN t.status IN ('resolved','closed') THEN 1 ELSE 0 END`,
        'ASC',
      )
      .addOrderBy('t.created_at', 'DESC')
      .limit(query.limit ?? 50)
      .offset((query.page ?? 0) * (query.limit ?? 50));

    if (query.status) qb.andWhere('t.status = :s', { s: query.status });
    if (query.category) qb.andWhere('t.category = :c', { c: query.category });
    if (query.assignedTo) qb.andWhere('t.assigned_to = :a', { a: query.assignedTo });
    if (query.search) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere('(t.subject ILIKE :term OR t.description ILIKE :term)', { term });
    }

    const [tickets, total] = await qb.getManyAndCount();
    const summaries = await Promise.all(tickets.map((t) => this.toSummary(t)));
    return { tickets: summaries, total };
  }

  async get(id: string): Promise<AdminTicketDetail> {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const base = await this.toSummary(ticket);
    const messages = await this.messageRepo.find({
      where: { ticketId: ticket.id },
      order: { createdAt: 'ASC' },
    });

    const staffIds = new Set<string>();
    const customerIds = new Set<string>();
    for (const m of messages) {
      if (m.authorType === 'staff') staffIds.add(m.authorId);
      if (m.authorType === 'customer') customerIds.add(m.authorId);
    }

    const staffMap = new Map<string, string>();
    for (const id of staffIds) {
      const s = await this.staffRepo.findOne({ where: { id } });
      if (s) staffMap.set(id, s.fullName);
    }
    const customerMap = new Map<string, string>();
    for (const id of customerIds) {
      const c = await this.customerRepo.findOne({ where: { id } });
      if (c) customerMap.set(id, c.fullName || c.phone);
    }

    return {
      ...base,
      description: ticket.description,
      messages: messages.map((m) => ({
        id: m.id,
        authorType: m.authorType,
        authorName:
          m.authorType === 'staff'
            ? staffMap.get(m.authorId) ?? 'Support'
            : m.authorType === 'customer'
              ? customerMap.get(m.authorId) ?? 'Customer'
              : 'System',
        message: m.message,
        isInternal: m.isInternal,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  async assign(
    id: string,
    staffId: string,
    dto: AssignTicketDto,
  ): Promise<AdminTicketDetail> {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const assignee = await this.staffRepo.findOne({ where: { id: dto.staffId } });
    if (!assignee) throw new NotFoundException('Staff not found');
    if (!assignee.isActive) {
      throw new BadRequestException('Cannot assign to an inactive staff member');
    }

    // Only NOC_DISPATCHER, FIELD_TECHNICIAN, SUPPORT_AGENT, SUPER_ADMIN can be assigned
    const role = await this.roleRepo.findOne({ where: { id: assignee.roleId } });
    const allowedRoles = ['NOC_DISPATCHER', 'FIELD_TECHNICIAN', 'SUPPORT_AGENT', 'SUPER_ADMIN'];
    if (!role || !allowedRoles.includes(role.name)) {
      throw new BadRequestException(
        `Staff role ${role?.name ?? 'UNKNOWN'} cannot be assigned tickets`,
      );
    }

    ticket.assignedToId = assignee.id;
    ticket.assignedAt = new Date();
    if (ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.ASSIGNED;
    }
    await this.ticketRepo.save(ticket);

    if (dto.note) {
      await this.messageRepo.save(
        this.messageRepo.create({
          ticketId: ticket.id,
          authorId: staffId,
          authorType: TicketMessageAuthorType.SYSTEM,
          message: `Assigned to ${assignee.fullName}. ${dto.note}`,
          isInternal: true,
          attachments: [],
        }),
      );
    }

    this.logger.log(
      `Ticket ${ticket.id} assigned to ${assignee.email} by staff=${staffId}`,
    );
    return this.get(id);
  }

  async updateStatus(
    id: string,
    staffId: string,
    dto: UpdateTicketStatusDto,
  ): Promise<AdminTicketDetail> {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const previousStatus = ticket.status;
    ticket.status = dto.status;

    if (dto.status === TicketStatus.RESOLVED) {
      ticket.resolvedAt = new Date();
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 7);
      ticket.reopenDeadline = deadline;
    }

    await this.ticketRepo.save(ticket);

    if (dto.note) {
      await this.messageRepo.save(
        this.messageRepo.create({
          ticketId: ticket.id,
          authorId: staffId,
          authorType: TicketMessageAuthorType.STAFF,
          message: dto.note,
          isInternal: false,
          attachments: [],
        }),
      );
    }

    await this.audit.record({
      actorId: staffId,
      actorType: 'staff',
      action: 'ticket.status_change',
      resourceType: 'ticket',
      resourceId: ticket.id,
      metadata: { from: previousStatus, to: dto.status, note: dto.note ?? null },
    });
    this.logger.log(
      `Ticket ${ticket.id} ${previousStatus} → ${dto.status} by staff=${staffId}`,
    );

    // SMS the customer on transitions that matter to them
    if (
      dto.status === TicketStatus.RESOLVED ||
      dto.status === TicketStatus.FIELD_TECH_DISPATCHED ||
      dto.status === TicketStatus.PENDING_CUSTOMER
    ) {
      const summary = await this.toSummary(ticket);
      if (summary.customerPhone) {
        await this.sendStatusSms(summary.customerPhone, summary.ticketNumber, dto.status);
      }
    }

    return this.get(id);
  }

  async reply(
    id: string,
    staffId: string,
    dto: StaffReplyDto,
  ): Promise<AdminTicketDetail> {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    await this.messageRepo.save(
      this.messageRepo.create({
        ticketId: ticket.id,
        authorId: staffId,
        authorType: TicketMessageAuthorType.STAFF,
        message: dto.message,
        isInternal: dto.isInternal ?? false,
        attachments: [],
      }),
    );

    // Move to pending_customer if we're waiting on them
    if (!dto.isInternal && ticket.status === TicketStatus.ASSIGNED) {
      ticket.status = TicketStatus.PENDING_CUSTOMER;
      await this.ticketRepo.save(ticket);
    }

    return this.get(id);
  }

  async listAssignableStaff(): Promise<
    Array<{ id: string; fullName: string; email: string; role: string }>
  > {
    const staff = await this.staffRepo.find({ where: { isActive: true } });
    const results: Array<{ id: string; fullName: string; email: string; role: string }> = [];
    for (const s of staff) {
      const role = await this.roleRepo.findOne({ where: { id: s.roleId } });
      if (!role) continue;
      if (!['NOC_DISPATCHER', 'FIELD_TECHNICIAN', 'SUPPORT_AGENT'].includes(role.name)) continue;
      results.push({
        id: s.id,
        fullName: s.fullName,
        email: s.email,
        role: role.name,
      });
    }
    return results;
  }

  private async sendStatusSms(
    phone: string,
    ticketNumber: string,
    status: TicketStatus,
  ): Promise<void> {
    const label =
      status === TicketStatus.RESOLVED
        ? 'has been resolved. Reply within 7 days to reopen if needed.'
        : status === TicketStatus.FIELD_TECH_DISPATCHED
          ? 'has a technician dispatched.'
          : status === TicketStatus.PENDING_CUSTOMER
            ? 'is waiting on your response.'
            : `is now ${status}.`;
    try {
      await this.sms.dispatch(
        phone,
        `PowerLink: Ticket ${ticketNumber} ${label}`,
        SmsCategory.TICKET,
      );
    } catch (err) {
      this.logger.warn(
        `Ticket status SMS failed for ${phone}: ${(err as Error).message}`,
      );
    }
  }

  private async toSummary(t: Ticket): Promise<AdminTicketSummary> {
    const account = await this.accountRepo.findOne({ where: { id: t.accountId } });
    const customer = account
      ? await this.customerRepo.findOne({ where: { id: account.customerId } })
      : null;

    let assignedToName: string | null = null;
    if (t.assignedToId) {
      const s = await this.staffRepo.findOne({ where: { id: t.assignedToId } });
      if (s) assignedToName = s.fullName;
    }

    return {
      id: t.id,
      ticketNumber: this.ticketNumber(t),
      subject: t.subject,
      category: t.category,
      status: t.status,
      priority: t.priority,
      customerName: customer?.fullName || '(unknown)',
      customerPhone: customer?.phone ?? '',
      assignedToId: t.assignedToId,
      assignedToName,
      ward: t.ward,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
    };
  }

  private ticketNumber(t: Ticket): string {
    const short = t.id.replace(/-/g, '').slice(0, 6).toUpperCase();
    const y = new Date(t.createdAt).getFullYear();
    return `TKT-${y}-${short}`;
  }
}
