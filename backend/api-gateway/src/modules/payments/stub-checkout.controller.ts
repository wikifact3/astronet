import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'crypto';

@Controller('payments/stub-checkout')
export class StubCheckoutController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  async page(@Query('token') token: string, @Res() res: Response) {
    if (!token) {
      res.status(400).send('Missing token');
      return;
    }

    let decoded: {
      paymentId: string;
      amount: number;
      invoiceNumber: string;
      returnUrl: string;
      webhookUrl: string;
    };
    try {
      decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'));
    } catch {
      res.status(400).send('Invalid token');
      return;
    }

    const secret = this.configService.get<string>('payment.stub.webhookSecret')!;
    const txnId = `STUB-${randomUUID()}`;

    const successPayload = JSON.stringify({
      paymentId: decoded.paymentId,
      providerTxnId: txnId,
      status: 'success',
      amount: decoded.amount,
    });
    const successSig = createHmac('sha256', secret).update(successPayload).digest('hex');

    const failurePayload = JSON.stringify({
      paymentId: decoded.paymentId,
      providerTxnId: txnId,
      status: 'failure',
      amount: decoded.amount,
    });
    const failureSig = createHmac('sha256', secret).update(failurePayload).digest('hex');

    const webhookAction = `${decoded.webhookUrl}?return=${encodeURIComponent(decoded.returnUrl)}`;

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Stub Payment Gateway</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f1f5f9; margin: 0; padding: 40px 16px; }
    .card { max-width: 420px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,.06); padding: 32px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    .muted { color: #64748b; font-size: 14px; }
    .row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .row:last-of-type { border-bottom: 0; }
    .amount { font-size: 24px; font-weight: 600; margin: 20px 0; }
    button { width: 100%; padding: 12px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; border: 0; margin-top: 12px; }
    .approve { background: #16a34a; color: white; }
    .decline { background: #f1f5f9; color: #334155; }
    .note { margin-top: 16px; font-size: 12px; color: #94a3b8; text-align: center; }
    form { margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Stub Payment Gateway</h1>
    <p class="muted">This is a local emulator. No real money moves.</p>
    <div class="row"><span>Invoice</span><strong>${decoded.invoiceNumber}</strong></div>
    <div class="row"><span>Provider txn</span><code>${txnId}</code></div>
    <div class="amount">Rs. ${Number(decoded.amount).toLocaleString('en-NP')}</div>

    <form method="POST" action="${webhookAction}">
      <input type="hidden" name="__raw" value='${successPayload}' />
      <input type="hidden" name="__sig" value="${successSig}" />
      <button class="approve" type="submit">Approve payment</button>
    </form>

    <form method="POST" action="${webhookAction}">
      <input type="hidden" name="__raw" value='${failurePayload}' />
      <input type="hidden" name="__sig" value="${failureSig}" />
      <button class="decline" type="submit">Decline</button>
    </form>

    <p class="note">After clicking, you'll be redirected back to the portal.</p>
  </div>
</body>
</html>`;

    res.type('html').send(html);
  }
}
