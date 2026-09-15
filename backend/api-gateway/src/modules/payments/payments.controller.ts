import {
  Body, Controller, Get, Headers, Param, Post, Query, Req, Res, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':provider/initiate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async initiate(
    @Param('provider') provider: string,
    @Body() dto: InitiatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.paymentsService.initiate(user.id, provider, dto.invoiceId, idempotencyKey ?? null);
  }

  @Get(':id/status')
  @UseGuards(JwtAuthGuard)
  async status(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.getStatus(user.id, id);
  }

  @Post(':provider/webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Query('return') returnParam: string | undefined,
    @Headers('x-signature') signatureHeader: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    let rawBody: string;
    let signature: string | null;

    if (typeof body?.__raw === 'string') {
      rawBody = body.__raw;
      signature = typeof body.__sig === 'string' ? body.__sig : null;
    } else {
      rawBody = req.rawBody?.toString('utf-8') ?? JSON.stringify(body);
      signature = signatureHeader ?? null;
    }

    const result = await this.paymentsService.handleWebhook(
      provider,
      rawBody,
      signature,
      req.headers,
    );

    // The stub checkout form posts here and expects a redirect back to the
    // portal. Real providers post and expect a JSON ack. Distinguish by the
    // presence of the `return` query param.
    if (returnParam) {
      res.redirect(returnParam);
      return;
    }

    res.json(result);
  }
}