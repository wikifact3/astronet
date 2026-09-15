import { registerAs } from '@nestjs/config';

export default registerAs('payment', () => {
  const apiPublicBaseUrl =
    process.env.API_PUBLIC_BASE_URL ||
    `http://localhost:${process.env.PORT || '8080'}`;

  return {
    apiPublicBaseUrl,
    portalPublicBaseUrl:
      process.env.PORTAL_PUBLIC_BASE_URL || 'http://localhost:3001',

    providerMode: (process.env.PAYMENT_PROVIDER_MODE || 'stub') as 'stub' | 'live',

    stub: {
      webhookSecret:
        process.env.PAYMENT_STUB_WEBHOOK_SECRET || 'stub-webhook-secret',
      // Derived, not separately configured. Overriding this independently
      // was the source of a config drift bug where the log showed one URL
      // and the stub redirect used another.
      checkoutBaseUrl: `${apiPublicBaseUrl}/v1/payments/stub-checkout`,
    },

    esewa: {
      merchantId: process.env.ESEWA_MERCHANT_ID || '',
      secretKey: process.env.ESEWA_SECRET_KEY || '',
      environment: (process.env.ESEWA_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
    },

    khalti: {
      secretKey: process.env.KHALTI_SECRET_KEY || '',
      environment: (process.env.KHALTI_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
    },
  };
});