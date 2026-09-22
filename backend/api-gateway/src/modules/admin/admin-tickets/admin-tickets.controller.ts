import {
  Body, Controller, Get, Param, Post, Query, UseGuards,
} from '@nestjs/common';
import { AdminJwtAuthGuard } from '../admin-auth/guards/admin-jwt-auth.guard';
import { RolesGuard } from '../admin-auth/guards/roles.guard';
import { Roles } from '../admin-auth/decorators/roles.decorator';
import { CurrentStaff } from '../admin-auth/decorators/current-staff.decorator';
import type { AuthenticatedStaff } from '../admin-auth/admin-auth.types';
import { AdminTicketsService } from './admin-tickets.service';
import { ListAdminTicketsQueryDto } from './dto/list-tickets.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { StaffReplyDto } from './dto/staff-reply.dto';

@Controller('admin/tickets')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('SUPPORT_AGENT', 'NOC_DISPATCHER', 'FIELD_TECHNICIAN', 'AUDITOR', 'SUPER_ADMIN')
export class AdminTicketsController {
  constructor(private readonly service: AdminTicketsService) {}

  @Get()
  async list(@Query() query: ListAdminTicketsQueryDto) {
    return this.service.list(query);
  }

  @Get('assignable-staff')
  async assignableStaff() {
    return { staff: await this.service.listAssignableStaff() };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post(':id/assign')
  @Roles('NOC_DISPATCHER', 'SUPPORT_AGENT', 'SUPER_ADMIN')
  async assign(
    @Param('id') id: string,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body() dto: AssignTicketDto,
  ) {
    return this.service.assign(id, staff.id, dto);
  }

  @Post(':id/status')
  @Roles('NOC_DISPATCHER', 'FIELD_TECHNICIAN', 'SUPPORT_AGENT', 'SUPER_ADMIN')
  async updateStatus(
    @Param('id') id: string,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.service.updateStatus(id, staff.id, dto);
  }

  @Post(':id/reply')
  @Roles('NOC_DISPATCHER', 'FIELD_TECHNICIAN', 'SUPPORT_AGENT', 'SUPER_ADMIN')
  async reply(
    @Param('id') id: string,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body() dto: StaffReplyDto,
  ) {
    return this.service.reply(id, staff.id, dto);
  }
}
