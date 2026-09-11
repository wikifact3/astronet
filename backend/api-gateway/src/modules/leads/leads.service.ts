
import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Lead, LeadStatus } from '../../database/entities/lead.entity';
import { CreateLeadDraftDto } from './dto/create-draft.dto';
import { UpdateLeadDraftDto } from './dto/update-draft.dto';

export interface LeadDraftResponse {
  id: string;
  draftToken: string;
  status: LeadStatus;
  province: string | null;
  district: string | null;
  municipality: string | null;
  ward: string | null;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  preferredPlanId: string | null;
  referenceId: string | null;
  submittedAt: string | null;
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
  ) {}

  async createDraft(dto: CreateLeadDraftDto): Promise<LeadDraftResponse> {
    const lead = new Lead();
    lead.draftToken = randomBytes(24).toString('hex');
    lead.status = LeadStatus.DRAFT;
    lead.province = dto.province ?? null;
    lead.district = dto.district ?? null;
    lead.municipality = dto.municipality ?? null;
    lead.ward = dto.ward ?? null;
    lead.fullName = null;
    lead.phone = null;
    lead.email = null;
    lead.street = null;
    lead.gpsLat = null;
    lead.gpsLng = null;
    lead.preferredPlanId = null;
    lead.notes = null;
    lead.referenceId = null;
    lead.submittedAt = null;

    const saved = await this.leadRepo.save(lead);
    return this.toResponse(saved);
  }

  async getByToken(token: string): Promise<LeadDraftResponse> {
    const lead = await this.leadRepo.findOne({ where: { draftToken: token } });
    if (!lead) throw new NotFoundException('Lead draft not found');
    return this.toResponse(lead);
  }

  async updateDraft(token: string, dto: UpdateLeadDraftDto): Promise<LeadDraftResponse> {
    const lead = await this.leadRepo.findOne({ where: { draftToken: token } });
    if (!lead) throw new NotFoundException('Lead draft not found');
    if (lead.status !== LeadStatus.DRAFT) {
      throw new BadRequestException(`Cannot edit lead in status ${lead.status}`);
    }

    if (dto.fullName !== undefined) lead.fullName = dto.fullName;
    if (dto.phone !== undefined) lead.phone = dto.phone;
    if (dto.email !== undefined) lead.email = dto.email;
    if (dto.province !== undefined) lead.province = dto.province;
    if (dto.district !== undefined) lead.district = dto.district;
    if (dto.municipality !== undefined) lead.municipality = dto.municipality;
    if (dto.ward !== undefined) lead.ward = dto.ward;
    if (dto.street !== undefined) lead.street = dto.street;
    if (dto.gpsLat !== undefined) lead.gpsLat = String(dto.gpsLat);
    if (dto.gpsLng !== undefined) lead.gpsLng = String(dto.gpsLng);
    if (dto.preferredPlanId !== undefined) lead.preferredPlanId = dto.preferredPlanId;
    if (dto.notes !== undefined) lead.notes = dto.notes;

    const saved = await this.leadRepo.save(lead);
    return this.toResponse(saved);
  }

  async submit(token: string): Promise<LeadDraftResponse> {
    const lead = await this.leadRepo.findOne({ where: { draftToken: token } });
    if (!lead) throw new NotFoundException('Lead draft not found');
    if (lead.status !== LeadStatus.DRAFT) {
      throw new BadRequestException(`Lead already ${lead.status}`);
    }

    const missing: string[] = [];
    if (!lead.fullName) missing.push('fullName');
    if (!lead.phone) missing.push('phone');
    if (!lead.province || !lead.district || !lead.municipality || !lead.ward) {
      missing.push('address');
    }
    if (missing.length > 0) {
      throw new BadRequestException(`Missing required fields: ${missing.join(', ')}`);
    }

    const referenceId = await this.generateReferenceId();
    lead.status = LeadStatus.SUBMITTED;
    lead.referenceId = referenceId;
    lead.submittedAt = new Date();

    const saved = await this.leadRepo.save(lead);
    this.logger.log(`Lead submitted: ${saved.id} ref=${referenceId}`);
    return this.toResponse(saved);
  }

  private async generateReferenceId(): Promise<string> {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const rand = randomBytes(3).toString('hex').toUpperCase().slice(0, 5);
    return `PL-${ym}-${rand}`;
  }

  private toResponse(lead: Lead): LeadDraftResponse {
    return {
      id: lead.id,
      draftToken: lead.draftToken,
      status: lead.status,
      province: lead.province,
      district: lead.district,
      municipality: lead.municipality,
      ward: lead.ward,
      fullName: lead.fullName,
      phone: lead.phone,
      email: lead.email,
      preferredPlanId: lead.preferredPlanId,
      referenceId: lead.referenceId,
      submittedAt: lead.submittedAt ? lead.submittedAt.toISOString() : null,
    };
  }
}