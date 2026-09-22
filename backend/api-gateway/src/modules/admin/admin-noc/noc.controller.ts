import {
  Body, Controller, Get, Post, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminJwtAuthGuard } from '../admin-auth/guards/admin-jwt-auth.guard';
import { RolesGuard } from '../admin-auth/guards/roles.guard';
import { Roles } from '../admin-auth/decorators/roles.decorator';
import { CurrentStaff } from '../admin-auth/decorators/current-staff.decorator';
import type { AuthenticatedStaff } from '../admin-auth/admin-auth.types';
import { NocService } from './noc.service';
import { BroadcastDto } from './dto/broadcast.dto';

@Controller('admin/noc')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('NOC_DISPATCHER', 'SUPER_ADMIN')
export class NocController {
  constructor(private readonly service: NocService) {}

  @Get('ward-view')
  async wardView() {
    return { groups: await this.service.wardView() };
  }

  @Get('technicians')
  async technicians() {
    return { technicians: await this.service.technicianLoad() };
  }

  @Post('broadcast')
  async broadcast(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body() dto: BroadcastDto,
    @Req() req: Request,
  ) {
    return this.service.broadcast(staff.id, dto, {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent']?.toString() ?? null,
    });
  }
}
