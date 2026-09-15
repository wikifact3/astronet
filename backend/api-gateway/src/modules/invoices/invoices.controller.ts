import {
  Controller, Get, Param, Post, Res, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './pdf.service';
import { Plan } from '../../database/entities/plan.entity';
import { Subscription } from '../../database/entities/subscription.entity';
import { Customer } from '../../database/entities/customer.entity';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly pdfService: InvoicePdfService,
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return { invoices: await this.invoicesService.listForCustomer(user.id) };
  }

  @Post('generate-current')
  @HttpCode(HttpStatus.OK)
  async generateCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.generateCurrentForCustomer(user.id);
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.getForCustomer(user.id, id);
  }

  @Get(':id/pdf')
  async downloadPdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const invoice = await this.invoicesService.getRawForCustomer(user.id, id);
    const sub = invoice.subscriptionId
      ? await this.subRepo.findOne({ where: { id: invoice.subscriptionId } })
      : null;
    const plan = sub ? await this.planRepo.findOne({ where: { id: sub.planId } }) : null;
    const customer = await this.customerRepo.findOne({ where: { id: user.id } });

    const buffer = this.pdfService.render(invoice, {
      planName: plan?.name ?? 'Plan',
      customerName: customer?.fullName ?? '',
      phone: customer?.phone ?? user.phone,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${invoice.invoiceNumber}.pdf"`,
    );
    res.send(buffer);
  }
}
