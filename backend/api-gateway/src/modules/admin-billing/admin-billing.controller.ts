import {
  Body, Controller, Get, Param, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminJwtAuthGuard } from '../admin-auth/guards/admin-jwt-auth.guard';
import { RolesGuard } from '../admin-auth/guards/roles.guard';
import { Roles } from '../admin-auth/decorators/roles.decorator';
import { CurrentStaff } from '../admin-auth/decorators/current-staff.decorator';
import type { AuthenticatedStaff } from '../admin-auth/admin-auth.types';
import { AdminBillingService } from './admin-billing.service';
import { ListAdminInvoicesDto } from './dto/list-invoices.dto';
import { ManualAdjustmentDto } from './dto/manual-adjustment.dto';

@Controller('admin/billing')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('BILLING_ADMIN', 'AUDITOR', 'SUPER_ADMIN')
export class AdminBillingController {
  constructor(private readonly service: AdminBillingService) {}

  @Get('invoices')
  async listInvoices(@Query() query: ListAdminInvoicesDto) {
    return this.service.listInvoices(query);
  }

  @Get('invoices/:id')
  async getInvoice(@Param('id') id: string) {
    return this.service.getInvoice(id);
  }

  @Post('adjustments')
  @Roles('BILLING_ADMIN', 'SUPER_ADMIN')
  async adjust(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body() dto: ManualAdjustmentDto,
    @Req() req: Request,
  ) {
    return this.service.adjust(staff.id, dto, {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent']?.toString() ?? null,
    });
  }
}
