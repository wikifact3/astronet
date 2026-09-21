import {
  Body, Controller, Get, Param, Post, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CancellationsService } from './cancellations.service';
import { CreateCancellationDto } from './dto/create-cancellation.dto';

@Controller('cancellations')
@UseGuards(JwtAuthGuard)
export class CancellationsController {
  constructor(private readonly service: CancellationsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return { requests: await this.service.listForCustomer(user.id) };
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCancellationDto,
  ) {
    return this.service.createForCustomer(user.id, dto.reason);
  }

  @Post(':id/withdraw')
  async withdraw(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.withdraw(user.id, id);
  }
}
