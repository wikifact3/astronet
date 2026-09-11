import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  async list() {
    return { plans: await this.plansService.listActive() };
  }

  @Get(':id')
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.plansService.getById(id);
  }
}
