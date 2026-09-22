import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Lead, LeadStatus } from '../../../database/entities/lead.entity';
import { LeadsService } from '../../leads/leads.service';
import { ListLeadsQueryDto } from './dto/list-leads.dto';

export interface AdminLeadItem {
  id: string;
  referenceId: string | null;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  province: string | null;
  district: string | null;
  municipality: string | null;
  ward: string | null;
  status: LeadStatus;
  submittedAt: string | null;
  accountId: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  promotedBy: string | null;
  promotedAt: string | null;
  internalNotes: string | null;
}

@Injectable()
export class AdminLeadsService {
  private readonly logger = new Logger(AdminLeadsService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    private readonly leadsService: LeadsService,
  ) {}

  async list(
    query: ListLeadsQueryDto,
  ): Promise<{ leads: AdminLeadItem[]; total: number }> {
    const qb = this.leadRepo
      .createQueryBuilder('l')
      .where('l.status != :draft', { draft: LeadStatus.DRAFT })
      .orderBy('l.submitted_at', 'DESC', 'NULLS LAST')
      .limit(query.limit ?? 50)
      .offset((query.page ?? 0) * (query.limit ?? 50));

    if (query.status) {
      qb.andWhere('l.status = :status', { status: query.status });
    }

    if (query.search) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        '(l.full_name ILIKE :term OR l.phone ILIKE :term OR l.reference_id ILIKE :term)',
        { term },
      );
    }

    const [leads, total] = await qb.getManyAndCount();
    return { leads: leads.map((l) => this.toItem(l)), total };
  }

  async get(id: string): Promise<AdminLeadItem> {
    const lead = await this.leadRepo.findOne({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    return this.toItem(lead);
  }

  async verify(
    id: string,
    staffId: string,
    notes?: string,
  ): Promise<AdminLeadItem> {
    const result = await this.leadsService.verifyLead(id, staffId, notes);
    return this.get(result.id);
  }

  async promote(
    id: string,
    staffId: string,
  ): Promise<{ lead: AdminLeadItem; accountId: string; alreadyPromoted: boolean }> {
    const result = await this.leadsService.promoteLead(id, staffId);
    const lead = await this.get(id);
    return { lead, ...result };
  }

  async reject(id: string, staffId: string, reason?: string): Promise<AdminLeadItem> {
    const lead = await this.leadRepo.findOne({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    if (lead.accountId) {
      throw new BadRequestException(
        'Lead is already promoted to an account and cannot be rejected',
      );
    }

    lead.status = LeadStatus.REJECTED;
    if (reason) lead.internalNotes = reason;
    await this.leadRepo.save(lead);
    this.logger.log(`Lead ${id} rejected by staff=${staffId}`);
    return this.get(id);
  }

  private toItem(l: Lead): AdminLeadItem {
    return {
      id: l.id,
      referenceId: l.referenceId,
      fullName: l.fullName,
      phone: l.phone,
      email: l.email,
      province: l.province,
      district: l.district,
      municipality: l.municipality,
      ward: l.ward,
      status: l.status,
      submittedAt: l.submittedAt ? l.submittedAt.toISOString() : null,
      accountId: l.accountId,
      verifiedBy: l.verifiedBy,
      verifiedAt: l.verifiedAt ? l.verifiedAt.toISOString() : null,
      promotedBy: l.promotedBy,
      promotedAt: l.promotedAt ? l.promotedAt.toISOString() : null,
      internalNotes: l.internalNotes,
    };
  }
}
