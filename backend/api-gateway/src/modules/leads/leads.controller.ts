import { Controller, Post, Get, Patch, Body, Param } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDraftDto } from './dto/create-draft.dto';
import { UpdateLeadDraftDto } from './dto/update-draft.dto';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post('draft')
  createDraft(@Body() dto: CreateLeadDraftDto) {
    return this.leadsService.createDraft(dto);
  }

  @Get('draft/:token')
  getDraft(@Param('token') token: string) {
    return this.leadsService.getByToken(token);
  }

  @Patch('draft/:token')
  updateDraft(@Param('token') token: string, @Body() dto: UpdateLeadDraftDto) {
    return this.leadsService.updateDraft(token, dto);
  }

  @Post('draft/:token/submit')
  submit(@Param('token') token: string) {
    return this.leadsService.submit(token);
  }
}
