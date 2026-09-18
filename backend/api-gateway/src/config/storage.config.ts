import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => {
  const internalEndpoint = `http${
    process.env.MINIO_USE_SSL === 'true' ? 's' : ''
  }://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`;

  return {
    s3: {
      endpoint: internalEndpoint,
      region: process.env.MINIO_REGION || 'us-east-1',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
      forcePathStyle: true,
    },
    // The public endpoint is what appears in presigned URLs. In dev it's
    // the Codespaces-forwarded MinIO. In production it'll be the R2 bucket
    // domain or an S3 custom domain.
    publicEndpoint:
      process.env.MINIO_PUBLIC_ENDPOINT || internalEndpoint,
    buckets: {
      quarantine: process.env.MINIO_QUARANTINE_BUCKET || 'powerlink-kyc-quarantine',
      approved: process.env.MINIO_APPROVED_BUCKET || 'powerlink-kyc-approved',
      invoices: process.env.MINIO_INVOICES_BUCKET || 'powerlink-invoices',
    },
  };
});
