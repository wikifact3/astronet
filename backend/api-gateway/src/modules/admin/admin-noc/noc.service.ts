import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { Ticket, TicketStatus } from '../../../database/entities/ticket.entity';
import { Account, AccountStatus } from '../../../database/entities/account.entity';
import { Customer } from '../../../database/entities/customer.entity';
import { StaffUser } from '../../../database/entities/staff-user.entity';
import { Role } from '../../../database/entities/role.entity';
import { SmsService } from '../../sms/sms.service';
import { SmsCategory } from '../../../database/entities/sms-log.entity';
import { AuditService } from '../../audit/audit.service';
import { BroadcastCategory, BroadcastDto } from './dto/broadcast.dto';

export interface WardGroup {
  ward: string;
  openCount: number;
  urgentCount: number;
  tickets: Array<{
    id: string;
    ticketNumber: string;
    subject: string;
    category: string;
    status: TicketStatus;
    priority: string;
    customerName: string;
    customerPhone: string;
    assignedToName: string | null;
    createdAt: string;
    ageHours: number;
  }>;
}

export interface TechnicianLoad {
  id: string;
  fullName: string;
  email: string;
  role: string;
  wardAccess: string[] | null;
  openTickets: number;
  assignedToday: number;
}

export interface BroadcastResult {
  jobId: string;
  recipients: number;
  wards: string[];
  category: BroadcastCategory;
}

const PHONE_RE = /^(98|97|96)\d{8}$/;

@Injectable()
export class NocService {
  private readonly logger = new Logger(NocService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
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

  /**
   * Groups all open tickets by Ward. Ward is populated on tickets for
   * customers whose account has an installation address with a ward.
   * Tickets without a Ward land in the "(unassigned)" group.
   */
  async wardView(): Promise<WardGroup[]> {
    const open = await this.ticketRepo.find({
      where: {
        status: Not(In([TicketStatus.CLOSED, TicketStatus.RESOLVED])),
      },
      order: { createdAt: 'ASC' },
      take: 500,
    });

    const groups = new Map<string, WardGroup>();

    for (const t of open) {
      const account = await this.accountRepo.findOne({ where: { id: t.accountId } });
      const customer = account
        ? await this.customerRepo.findOne({ where: { id: account.customerId } })
        : null;

      const ward = t.ward ?? '(unassigned)';

      if (!groups.has(ward)) {
        groups.set(ward, {
          ward,
          openCount: 0,
          urgentCount: 0,
          tickets: [],
        });
      }

      const group = groups.get(ward)!;
      group.openCount += 1;
      if (t.priority === 'high' || t.priority === 'critical') {
        group.urgentCount += 1;
      }

      let assignedToName: string | null = null;
      if (t.assignedToId) {
        const s = await this.staffRepo.findOne({ where: { id: t.assignedToId } });
        if (s) assignedToName = s.fullName;
      }

      const ageMs = Date.now() - t.createdAt.getTime();

      group.tickets.push({
        id: t.id,
        ticketNumber: this.ticketNumber(t),
        subject: t.subject,
        category: t.category,
        status: t.status,
        priority: t.priority,
        customerName: customer?.fullName ?? '(unknown)',
        customerPhone: customer?.phone ?? '',
        assignedToName,
        createdAt: t.createdAt.toISOString(),
        ageHours: Math.floor(ageMs / (1000 * 60 * 60)),
      });
    }

    // Sort groups: largest first, with urgent counted
    return Array.from(groups.values()).sort(
      (a, b) => b.urgentCount - a.urgentCount || b.openCount - a.openCount,
    );
  }

  /**
   * Technician load. Counts open tickets assigned to each dispatcher /
   * field tech, plus anything assigned in the last 24h.
   */
  async technicianLoad(): Promise<TechnicianLoad[]> {
    const staff = await this.staffRepo.find({ where: { isActive: true } });

    const result: TechnicianLoad[] = [];
    const allowedRoles = ['NOC_DISPATCHER', 'FIELD_TECHNICIAN', 'SUPPORT_AGENT'];

    for (const s of staff) {
      const role = await this.roleRepo.findOne({ where: { id: s.roleId } });
      if (!role || !allowedRoles.includes(role.name)) continue;

      const openTickets = await this.ticketRepo.count({
        where: {
          assignedToId: s.id,
          status: Not(In([TicketStatus.CLOSED, TicketStatus.RESOLVED])),
        },
      });

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const assignedToday = await this.ticketRepo
        .createQueryBuilder('t')
        .where('t.assigned_to = :id', { id: s.id })
        .andWhere('t.assigned_at >= :since', { since })
        .getCount();

      result.push({
        id: s.id,
        fullName: s.fullName,
        email: s.email,
        role: role.name,
        wardAccess: s.wardAccess,
        openTickets,
        assignedToday,
      });
    }

    return result.sort((a, b) => a.openTickets - b.openTickets);
  }

  /**
   * Broadcast SMS to all active customers whose installation address
   * ward matches one of the target wards. If no wards are given, the
   * broadcast goes to every active customer (bounded by safety cap).
   */
  async broadcast(
    staffId: string,
    dto: BroadcastDto,
    ctx: { ip: string | null; userAgent: string | null },
  ): Promise<BroadcastResult> {
    const wardFilter = dto.wards?.filter((w) => w.trim().length > 0) ?? [];

    const accounts = await this.accountRepo.find({
      where: { status: AccountStatus.ACTIVE },
      take: 10_000,
    });

    // Filter by ward from installation_address JSONB
    const filtered = wardFilter.length
      ? accounts.filter((a) => {
          const addr = a.installationAddress as { ward?: string } | null;
          return addr?.ward && wardFilter.includes(addr.ward);
        })
      : accounts;

    if (filtered.length === 0) {
      throw new BadRequestException(
        wardFilter.length
          ? 'No active customers in the specified wards'
          : 'No active customers',
      );
    }

    const recipientPhones = new Set<string>();
    for (const acc of filtered) {
      const c = await this.customerRepo.findOne({ where: { id: acc.customerId } });
      if (c?.phone) recipientPhones.add(c.phone);
    }

    const phones = Array.from(recipientPhones);

    // Dispatch SMS synchronously for now — a queue is a Phase 2 concern
    // once volume justifies it.
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const phone of phones) {
      if (!PHONE_RE.test(phone)) {
        skipped += 1;
        this.logger.warn(`Broadcast: skipping invalid phone ${phone}`);
        continue;
      }
      try {
        const res = await this.sms.dispatch(
          phone,
          dto.message,
          SmsCategory.BROADCAST,
        );
        if (res.success) sent += 1;
        else failed += 1;
      } catch (err) {
        failed += 1;
        this.logger.warn(
          `Broadcast SMS failed for ${phone}: ${(err as Error).message}`,
        );
      }
    }

    await this.audit.record({
      actorId: staffId,
      actorType: 'staff',
      action: 'noc.broadcast',
      resourceType: 'broadcast',
      resourceId: null, // bulk operation — no single resource
      metadata: {
        wards: wardFilter,
        category: dto.category,
        recipients: sent,
        failed,
        skipped,
        messagePreview: dto.message.slice(0, 100),
      },
      ipAddress: ctx.ip ?? undefined,
      userAgent: ctx.userAgent ?? undefined,
    });

    this.logger.log(
      `Broadcast sent: category=${dto.category} wards=${wardFilter.join(',') || 'ALL'} recipients=${sent} failed=${failed} skipped=${skipped}`,
    );

    return {
      jobId: `broadcast-${Date.now()}`,
      recipients: sent,
      wards: wardFilter,
      category: dto.category,
    };
  }

  private ticketNumber(t: Ticket): string {
    const short = t.id.replace(/-/g, '').slice(0, 6).toUpperCase();
    const y = new Date(t.createdAt).getFullYear();
    return `TKT-${y}-${short}`;
  }
}
