export interface SendSmsParams {
  phone: string;
  message: string;
  category: string;
}

export interface SendSmsResult {
  success: boolean;
  provider: string;
  providerMessageId: string | null;
  error: string | null;
}

export interface SmsProvider {
  readonly name: string;
  send(params: SendSmsParams): Promise<SendSmsResult>;
}
