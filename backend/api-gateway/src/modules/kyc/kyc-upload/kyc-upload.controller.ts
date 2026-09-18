import {
  Body, Controller, Get, Param, Post, UploadedFile,
  UseGuards, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { KycUploadService } from './kyc-upload.service';
import { CreateKycSessionDto } from './dto/create-session.dto';

@Controller('kyc')
@UseGuards(JwtAuthGuard)
export class KycUploadController {
  constructor(private readonly kycService: KycUploadService) {}

  @Post('sessions')
  async createSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateKycSessionDto,
  ) {
    return this.kycService.createSession(user.id, dto);
  }

  @Post('upload/:sessionId')
  @UseInterceptors(
    FileInterceptor('file', {
      // In-memory because files are small and we validate before writing.
      // Larger files in Phase 2 would stream to disk or direct-to-S3.
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // hard cap; per-config validation follows
    }),
  )
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('No file provided (field name must be "file")');
    return this.kycService.upload(user.id, sessionId, file);
  }

  @Get('documents')
  async listDocuments(@CurrentUser() user: AuthenticatedUser) {
    return { documents: await this.kycService.listDocuments(user.id) };
  }
}
