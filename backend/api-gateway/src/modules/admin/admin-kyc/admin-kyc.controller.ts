import {
  Body, Controller, Get, Param, Post, Query, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminJwtAuthGuard } from '../admin-auth/guards/admin-jwt-auth.guard';
import { RolesGuard } from '../admin-auth/guards/roles.guard';
import { Roles } from '../admin-auth/decorators/roles.decorator';
import { CurrentStaff } from '../admin-auth/decorators/current-staff.decorator';
import type { AuthenticatedStaff } from '../admin-auth/admin-auth.types';
import { AdminKycService } from './admin-kyc.service';
import { ReviewKycDto } from './dto/review-kyc.dto';
import { KycStatus } from '../../../database/entities/kyc-document.entity';

@Controller('admin/kyc')
@UseGuards(AdminJwtAuthGuard, RolesGuard)
@Roles('KYC_REVIEWER', 'SUPER_ADMIN')
export class AdminKycController {
  constructor(private readonly kycService: AdminKycService) {}

  @Get()
  async list(@Query('status') status?: KycStatus) {
    return { documents: await this.kycService.list(status) };
  }

  @Get(':id/file')
  async streamFile(@Param('id') id: string, @Res() res: Response) {
    await this.kycService.streamFile(id, res);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.kycService.get(id);
  }

  @Post(':id/signed-url')
  async signedUrl(@Param('id') id: string) {
    return this.kycService.signedUrl(id);
  }

  @Post(':id/review')
  async review(
    @Param('id') id: string,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body() dto: ReviewKycDto,
  ) {
    return this.kycService.review(id, staff.id, dto);
  }
}
