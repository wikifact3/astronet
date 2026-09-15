export interface InitiateParams {
  paymentId: string;
  amount: number;
  invoiceNumber: string;
  customerPhone: string;
  returnUrl: string;
  webhookUrl: string;
}

export interface InitiateResult {
  redirectUrl: string;
  providerTxnId: string | null;
}

export interface WebhookVerifyInput {
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
  signature: string | null;
}

export interface WebhookEvent {
  providerTxnId: string;
  status: 'success' | 'failure' | 'pending';
  amount: number | null;
  rawPayload: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: 'stub' | 'esewa' | 'khalti';
  initiate(params: InitiateParams): Promise<InitiateResult>;
  verifyWebhook(input: WebhookVerifyInput): Promise<WebhookEvent>;
}
