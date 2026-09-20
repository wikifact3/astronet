import {
  Body, Controller, Get, Param, Post, Query, UseGuards,
} from '@nestjs/common';
import { AdminJwtAuthGuard } from '../admin-auth/guards/admin-jwt-auth.guard';
import { RolesGuard } from '../admin-auth/guards/roles.guard';
import { Roles } from '../admin-auth/decorators/roles.decorator';
import { CurrentStaff } from '../admin-auth/decorators/current-staff.decorator';
import type { AuthenticatedStaff } from '../admin-auth/admin-auth.types';
import { AdminLeadsService } from './admin-leads.service';
import { ListLeadsQueryDto } from './dto/list-leads.dto';
import { VerifyLeadDto } from './dto/verify-lead.dto';
import { RejectLeadDto } from './dto/reject-lead.dto';

@Controller('admin/leads')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('SUPPORT_AGENT', 'CRM_VERIFIER', 'AUDITOR', 'SUPER_ADMIN')
export class AdminLeadsController {
  constructor(private readonly service: AdminLeadsService) {}

  @Get()
  async list(@Query() query: ListLeadsQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post(':id/verify')
  @Roles('SUPPORT_AGENT', 'CRM_VERIFIER', 'SUPER_ADMIN')
  async verify(
    @Param('id') id: string,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body() dto: VerifyLeadDto,
  ) {
    return this.service.verify(id, staff.id, dto.notes);
  }

  @Post(':id/promote')
  @Roles('SUPER_ADMIN')
  async promote(
    @Param('id') id: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.service.promote(id, staff.id);
  }

  @Post(':id/reject')
  @Roles('SUPPORT_AGENT', 'CRM_VERIFIER', 'SUPER_ADMIN')
  async reject(
    @Param('id') id: string,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body() dto: RejectLeadDto,
  ) {
    return this.service.reject(id, staff.id, dto.reason);
  }
}
