
import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Lead, LeadStatus } from '../../database/entities/lead.entity';
import { Customer, KycStatus as CustomerKycStatus } from '../../database/entities/customer.entity';
import { Account, AccountStatus, AccountType } from '../../database/entities/account.entity';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
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
  accountId: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  promotedBy: string | null;
  promotedAt: string | null;
  internalNotes: string | null;
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
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

    const autoPromote = this.configService.get<boolean>('leads.autoPromote', true);

    if (!autoPromote) {
      // Just mark the lead as submitted. An admin will verify and promote it
      // through the CRM UI, which calls promoteLead() below.
      lead.status = LeadStatus.SUBMITTED;
      lead.referenceId = referenceId;
      lead.submittedAt = new Date();
      await this.leadRepo.save(lead);

      this.logger.log(
        `Lead submitted (pending manual promotion): ${lead.id} ref=${referenceId}`,
      );
      return this.toResponse(lead);
    }

    // Promote: find-or-create customer, then create account with status=lead.
    // Runs in a transaction so a partial failure doesn't leave an orphan account.
    const accountId = await this.dataSource.transaction(async (manager) => {
      // Duplicate check: same phone already has a pending lead?
      const existingLead = await manager.findOne(Lead, {
        where: {
          phone: lead.phone!,
          status: In([LeadStatus.SUBMITTED, LeadStatus.CONTACTED]),
        },
      });
      if (existingLead && existingLead.id !== lead.id) {
        throw new BadRequestException(
          'A pending request already exists for this phone number. Our team will be in touch.',
        );
      }

      // Find or create the customer
      let customer = await manager.findOne(Customer, {
        where: { phone: lead.phone! },
      });
      if (!customer) {
        customer = manager.create(Customer, {
          phone: lead.phone!,
          email: lead.email ?? null,
          fullName: lead.fullName!,
          preferredLanguage: 'en',
          kycStatus: CustomerKycStatus.PENDING,
        });
        customer = await manager.save(customer);
      } else {
        // Existing customer: only fill in blanks, don't overwrite
        if (!customer.fullName && lead.fullName) customer.fullName = lead.fullName;
        if (!customer.email && lead.email) customer.email = lead.email;
        await manager.save(customer);
      }

      // Create the account
      const account = manager.create(Account, {
        customerId: customer.id,
        accountType: AccountType.RETAIL,
        status: AccountStatus.LEAD,
        installationAddress: {
          province: lead.province,
          district: lead.district,
          municipality: lead.municipality,
          ward: lead.ward,
          street: lead.street,
        },
        gpsCoordinates:
          lead.gpsLat !== null && lead.gpsLng !== null
            ? { lat: Number(lead.gpsLat), lng: Number(lead.gpsLng) }
            : null,
        referralCode: this.generateReferralCode(),
        parentAccountId: null,
        referredById: null,
      });
      const saved = await manager.save(account);

      // Update the lead with the link and submitted status
      lead.status = LeadStatus.SUBMITTED;
      lead.referenceId = referenceId;
      lead.submittedAt = new Date();
      lead.accountId = saved.id;
      lead.promotedAt = new Date();
      lead.promotedBy = null; // system
      await manager.save(lead);

      return saved.id;
    });

    this.logger.log(
      `Lead submitted: ${lead.id} ref=${referenceId} account=${accountId}`,
    );
    return this.toResponse(lead);
  }

  /**
   * Manual promotion. Called by an admin when auto-promote is off, or for
   * any lead the team wants to move into an account manually. Idempotent:
   * if the lead already has an account_id, returns it unchanged.
   */
  async promoteLead(
    leadId: string,
    staffId: string,
  ): Promise<{ accountId: string; alreadyPromoted: boolean }> {
    const lead = await this.leadRepo.findOne({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    if (lead.accountId) {
      return { accountId: lead.accountId, alreadyPromoted: true };
    }
    if (lead.status === LeadStatus.REJECTED || lead.status === LeadStatus.EXPIRED) {
      throw new BadRequestException(`Cannot promote a ${lead.status} lead`);
    }
    if (!lead.phone || !lead.fullName) {
      throw new BadRequestException('Lead is missing phone or name');
    }

    const accountId = await this.dataSource.transaction(async (manager) => {
      let customer = await manager.findOne(Customer, {
        where: { phone: lead.phone! },
      });
      if (!customer) {
        customer = manager.create(Customer, {
          phone: lead.phone!,
          email: lead.email ?? null,
          fullName: lead.fullName!,
          preferredLanguage: 'en',
          kycStatus: CustomerKycStatus.PENDING,
        });
        customer = await manager.save(customer);
      } else {
        if (!customer.fullName && lead.fullName) customer.fullName = lead.fullName;
        if (!customer.email && lead.email) customer.email = lead.email;
        await manager.save(customer);
      }

      const account = manager.create(Account, {
        customerId: customer.id,
        accountType: AccountType.RETAIL,
        status: AccountStatus.LEAD,
        installationAddress: {
          province: lead.province,
          district: lead.district,
          municipality: lead.municipality,
          ward: lead.ward,
          street: lead.street,
        },
        gpsCoordinates:
          lead.gpsLat !== null && lead.gpsLng !== null
            ? { lat: Number(lead.gpsLat), lng: Number(lead.gpsLng) }
            : null,
        referralCode: this.generateReferralCode(),
        parentAccountId: null,
        referredById: null,
      });
      const saved = await manager.save(account);

      lead.accountId = saved.id;
      lead.promotedBy = staffId;
      lead.promotedAt = new Date();
      lead.status = LeadStatus.CONVERTED;
      await manager.save(lead);

      return saved.id;
    });

    this.logger.log(
      `Lead ${leadId} manually promoted to account ${accountId} by staff=${staffId}`,
    );
    return { accountId, alreadyPromoted: false };
  }

  /**
   * Mark a lead as verified (phone/email confirmed, coverage checked).
   * Does not create an account — that is a separate action.
   */
  async verifyLead(
    leadId: string,
    staffId: string,
    notes?: string,
  ): Promise<LeadDraftResponse> {
    const lead = await this.leadRepo.findOne({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    if (lead.status === LeadStatus.REJECTED || lead.status === LeadStatus.EXPIRED) {
      throw new BadRequestException(`Cannot verify a ${lead.status} lead`);
    }

    lead.verifiedBy = staffId;
    lead.verifiedAt = new Date();
    if (notes) lead.internalNotes = notes;
    if (lead.status === LeadStatus.SUBMITTED) {
      lead.status = LeadStatus.CONTACTED;
    }
    await this.leadRepo.save(lead);

    this.logger.log(`Lead ${leadId} verified by staff=${staffId}`);
    return this.toResponse(lead);
  }

  private generateReferralCode(): string {
    const rand = randomBytes(4).toString('hex').toUpperCase();
    return `PL${rand}`;
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
      accountId: lead.accountId ?? null,
      verifiedBy: lead.verifiedBy ?? null,
      verifiedAt: lead.verifiedAt ? lead.verifiedAt.toISOString() : null,
      promotedBy: lead.promotedBy ?? null,
      promotedAt: lead.promotedAt ? lead.promotedAt.toISOString() : null,
      internalNotes: lead.internalNotes ?? null,
    };
  }
}