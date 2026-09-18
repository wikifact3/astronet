import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  s3: {
    endpoint: `http${process.env.MINIO_USE_SSL === 'true' ? 's' : ''}://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`,
    region: process.env.MINIO_REGION || 'us-east-1',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    forcePathStyle: true,
  },
  buckets: {
    quarantine: process.env.MINIO_QUARANTINE_BUCKET || 'powerlink-kyc-quarantine',
    approved: process.env.MINIO_APPROVED_BUCKET || 'powerlink-kyc-approved',
    invoices: process.env.MINIO_INVOICES_BUCKET || 'powerlink-invoices',
  },
}));
