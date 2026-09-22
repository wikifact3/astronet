import {
  Body, Controller, Get, Param, Post, Query, UseGuards,
} from '@nestjs/common';
import { AdminJwtAuthGuard } from '../admin-auth/guards/admin-jwt-auth.guard';
import { RolesGuard } from '../admin-auth/guards/roles.guard';
import { Roles } from '../admin-auth/decorators/roles.decorator';
import { CurrentStaff } from '../admin-auth/decorators/current-staff.decorator';
import type { AuthenticatedStaff } from '../admin-auth/admin-auth.types';
import { AdminCrmService } from './admin-crm.service';
import { ListAccountsQueryDto } from './dto/list-accounts.dto';
import { TransitionStatusDto } from './dto/transition-status.dto';

@Controller('admin/accounts')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('SUPPORT_AGENT', 'KYC_REVIEWER', 'NOC_DISPATCHER', 'BILLING_ADMIN', 'SUPER_ADMIN')
export class AdminCrmController {
  constructor(private readonly crmService: AdminCrmService) {}

  @Get()
  async list(@Query() query: ListAccountsQueryDto) {
    return this.crmService.list(query);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.crmService.get(id);
  }

  @Post(':id/transition')
  @Roles('SUPPORT_AGENT', 'SUPER_ADMIN')
  async transition(
    @Param('id') id: string,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body() dto: TransitionStatusDto,
  ) {
    return this.crmService.transition(id, staff.id, dto);
  }
}
