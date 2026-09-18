import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import {
  KycDocument,
  KycPipelineStatus,
  KycStatus,
} from '../../../database/entities/kyc-document.entity';
import { S3Service } from '../../storage/s3.service';

interface ScanJob {
  documentId: string;
}

@Processor('kyc')
export class KycScanProcessor {
  private readonly logger = new Logger(KycScanProcessor.name);

  constructor(
    @InjectRepository(KycDocument)
    private readonly docRepo: Repository<KycDocument>,
    private readonly s3: S3Service,
    private readonly configService: ConfigService,
  ) {}

  @Process('scan')
  async handleScan(job: Job<ScanJob>): Promise<void> {
    const { documentId } = job.data;
    const cfg = this.configService.get('kyc') as {
      maxFileBytes: number;
      allowedMimeTypes: string[];
      sessionTtlMinutes: number;
      signedUrlTtlSeconds: number;
      scanStubDelayMs: number;
      maxDocumentsPerAccount: number;
    };

    const doc = await this.docRepo.findOne({ where: { id: documentId } });
    if (!doc) {
      this.logger.warn(`Scan job for missing document ${documentId}`);
      return;
    }

    if (
      doc.pipelineStatus !== KycPipelineStatus.UPLOADED &&
      doc.pipelineStatus !== KycPipelineStatus.SCANNING
    ) {
      this.logger.warn(
        `Scan job for document ${documentId} in unexpected status ${doc.pipelineStatus}`,
      );
      return;
    }

    doc.pipelineStatus = KycPipelineStatus.SCANNING;
    doc.scanStartedAt = new Date();
    await this.docRepo.save(doc);

    try {
      // ------- STUB SCAN -------
      // Phase 1: simulate a scanner. Delay so the async path is exercised.
      // Phase 2: swap this block for a ClamAV daemon call or a VirusTotal /
      //          cloud AV provider. The surrounding pipeline stays identical.
      await this.sleep(cfg.scanStubDelayMs);

      // Deterministic stub rule: reject files whose original filename
      // contains "infected" so we can test the failure path.
      const isInfected = (doc.originalFilename ?? '')
        .toLowerCase()
        .includes('infected');

      if (isInfected) {
        doc.pipelineStatus = KycPipelineStatus.FAILED;
        doc.scanResult = 'infected_stub';
        doc.scanCompletedAt = new Date();
        doc.processingNotes = 'Rejected by stub scanner (filename matched "infected").';
        await this.docRepo.save(doc);

        // Delete from quarantine
        if (doc.quarantineKey) {
          await this.s3.deleteObject('quarantine', doc.quarantineKey);
        }

        this.logger.warn(`KYC scan rejected (stub): doc=${doc.id}`);
        return;
      }

      // Clean — move from quarantine to approved bucket
      if (!doc.quarantineKey) {
        throw new Error('Missing quarantine key');
      }
      const approvedKey = doc.quarantineKey.replace(/^quarantine\//, 'documents/');

      await this.s3.copyObject('quarantine', doc.quarantineKey, 'approved', approvedKey);
      await this.s3.deleteObject('quarantine', doc.quarantineKey);

      doc.storageKey = approvedKey;
      doc.quarantineKey = null;
      doc.encryptedFileRef = approvedKey;
      doc.scanResult = 'clean_stub';
      doc.scanCompletedAt = new Date();

      // Move to next state: PROCESSING (OCR/verification would happen here)
      doc.pipelineStatus = KycPipelineStatus.PROCESSING;
      await this.docRepo.save(doc);

      // Phase 1: no OCR/verification. Straight to "verified" so the admin
      // queue sees it. Phase 2: enqueue kyc.verify job here.
      doc.pipelineStatus = KycPipelineStatus.VERIFIED;
      doc.status = KycStatus.PENDING; // admin review still required
      await this.docRepo.save(doc);

      this.logger.log(
        `KYC scan passed (stub): doc=${doc.id} moved to approved/${approvedKey}`,
      );
    } catch (err) {
      doc.pipelineStatus = KycPipelineStatus.FAILED;
      doc.scanResult = 'error';
      doc.scanCompletedAt = new Date();
      doc.processingNotes = `Scan error: ${(err as Error).message}`.slice(0, 1000);
      await this.docRepo.save(doc);
      this.logger.error(`KYC scan failed: doc=${doc.id} err=${(err as Error).message}`);
      throw err; // let Bull retry
    }
  }

  @OnQueueFailed()
  onFailed(job: Job<ScanJob>, err: Error): void {
    this.logger.error(
      `KYC scan job ${job.id} failed after ${job.attemptsMade} attempts: ${err.message}`,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
