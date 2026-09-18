import {
  Injectable, Logger, NotFoundException, ForbiddenException,
  BadRequestException, PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { fromBuffer } from 'file-type';
import {
  KycUploadSession,
  KycUploadSessionStatus,
} from '../../../database/entities/kyc-upload-session.entity';
import {
  KycDocument,
  KycPipelineStatus,
} from '../../../database/entities/kyc-document.entity';
import { Account } from '../../../database/entities/account.entity';
import { S3Service } from '../../storage/s3.service';
import { CreateKycSessionDto } from './dto/create-session.dto';

export interface SessionResponse {
  id: string;
  documentType: string;
  expiresAt: string;
}

export interface DocumentResponse {
  id: string;
  documentType: string;
  pipelineStatus: KycPipelineStatus;
  mimeType: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewReasonCode: string | null;
  reviewNotes: string | null;
  scanResult: string | null;
}

@Injectable()
export class KycUploadService {
  private readonly logger = new Logger(KycUploadService.name);

  constructor(
    @InjectRepository(KycUploadSession)
    private readonly sessionRepo: Repository<KycUploadSession>,
    @InjectRepository(KycDocument)
    private readonly docRepo: Repository<KycDocument>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    private readonly s3: S3Service,
    private readonly configService: ConfigService,
    @InjectQueue('kyc') private readonly kycQueue: Queue,
  ) {}

  async createSession(
    customerId: string,
    dto: CreateKycSessionDto,
  ): Promise<SessionResponse> {
    const account = await this.pickPrimaryAccount(customerId);
    const cfg = this.configService.get('kyc') as {
      maxFileBytes: number;
      allowedMimeTypes: string[];
      sessionTtlMinutes: number;
      signedUrlTtlSeconds: number;
      scanStubDelayMs: number;
      maxDocumentsPerAccount: number;
    };

    // Idempotency: if an open session exists for the same document type,
    // return it instead of creating a new one.
    const existing = await this.sessionRepo.findOne({
      where: {
        accountId: account.id,
        documentType: dto.documentType,
        status: KycUploadSessionStatus.OPEN,
      },
    });
    if (existing && existing.expiresAt > new Date()) {
      return {
        id: existing.id,
        documentType: existing.documentType,
        expiresAt: existing.expiresAt.toISOString(),
      };
    }

    const session = this.sessionRepo.create({
      accountId: account.id,
      documentType: dto.documentType,
      status: KycUploadSessionStatus.OPEN,
      expiresAt: new Date(Date.now() + cfg.sessionTtlMinutes * 60 * 1000),
    });
    const saved = await this.sessionRepo.save(session);

    return {
      id: saved.id,
      documentType: saved.documentType,
      expiresAt: saved.expiresAt.toISOString(),
    };
  }

  async upload(
    customerId: string,
    sessionId: string,
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
  ): Promise<DocumentResponse> {
    const cfg = this.configService.get('kyc') as {
      maxFileBytes: number;
      allowedMimeTypes: string[];
      sessionTtlMinutes: number;
      signedUrlTtlSeconds: number;
      scanStubDelayMs: number;
      maxDocumentsPerAccount: number;
    };

    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Upload session not found');

    // Authorization: session must belong to one of the customer's accounts
    const account = await this.accountRepo.findOne({ where: { id: session.accountId } });
    if (!account || account.customerId !== customerId) {
      throw new ForbiddenException('Session does not belong to you');
    }

    if (session.status !== KycUploadSessionStatus.OPEN) {
      throw new BadRequestException(`Session is ${session.status}`);
    }
    if (session.expiresAt < new Date()) {
      session.status = KycUploadSessionStatus.EXPIRED;
      await this.sessionRepo.save(session);
      throw new BadRequestException('Upload session expired');
    }
    if (file.size > cfg.maxFileBytes) {
      throw new PayloadTooLargeException(
        `File exceeds ${Math.floor(cfg.maxFileBytes / (1024 * 1024))} MB limit`,
      );
    }

    // ----- MIME sniff (not trusting the extension or client header) -----
    const sniffed = await fromBuffer(file.buffer);
    if (!sniffed) {
      throw new BadRequestException('Could not determine file type');
    }
    if (!cfg.allowedMimeTypes.includes(sniffed.mime)) {
      throw new BadRequestException(
        `Unsupported file type: ${sniffed.mime}. Allowed: ${cfg.allowedMimeTypes.join(', ')}`,
      );
    }

    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    // Server-generated identifiers only. Never use the customer-supplied
    // filename as part of the storage key.
    const documentId = randomUUID();
    const ext = sniffed.ext ?? 'bin';
    const quarantineKey = `quarantine/${documentId}.${ext}`;

    // Write to quarantine bucket
    await this.s3.putObject(
      'quarantine',
      quarantineKey,
      file.buffer,
      sniffed.mime,
    );

    const doc = this.docRepo.create({
      id: documentId,
      accountId: session.accountId,
      documentType: session.documentType,
      // encrypted_file_ref is the canonical column; we store the quarantine
      // key here for compatibility with the existing schema. storage_key is
      // set when the file is moved to the approved bucket.
      encryptedFileRef: quarantineKey,
      quarantineKey,
      storageKey: null,
      checksumSha256: checksum,
      fileSizeBytes: String(file.size),
      mimeType: sniffed.mime,
      originalFilename: sanitizeFilename(file.originalname),
      pipelineStatus: KycPipelineStatus.UPLOADED,
      status: 'pending' as never,
      uploadSessionId: session.id,
    });
    await this.docRepo.save(doc);

    session.status = KycUploadSessionStatus.COMPLETED;
    await this.sessionRepo.save(session);

    this.logger.log(
      `KYC uploaded: doc=${doc.id} account=${session.accountId} type=${sniffed.mime} size=${file.size} sha256=${checksum.slice(0, 12)}…`,
    );

    // Enqueue scan job
    await this.kycQueue.add(
      'scan',
      { documentId: doc.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return this.toResponse(doc);
  }

  async listDocuments(customerId: string): Promise<DocumentResponse[]> {
    const account = await this.pickPrimaryAccount(customerId);
    const docs = await this.docRepo.find({
      where: { accountId: account.id },
      order: { createdAt: 'DESC' },
    });
    return docs.map((d) => this.toResponse(d));
  }

  private async pickPrimaryAccount(customerId: string): Promise<Account> {
    const accounts = await this.accountRepo.find({
      where: { customerId },
      order: { createdAt: 'ASC' },
    });
    if (accounts.length === 0) {
      throw new NotFoundException(
        'No account found. Apply for a new connection first.',
      );
    }
    return accounts[0];
  }

  private toResponse(doc: KycDocument): DocumentResponse {
    return {
      id: doc.id,
      documentType: doc.documentType,
      pipelineStatus: doc.pipelineStatus,
      mimeType: doc.mimeType,
      fileSizeBytes: doc.fileSizeBytes ? parseInt(doc.fileSizeBytes, 10) : null,
      createdAt: doc.createdAt.toISOString(),
      reviewedAt: doc.reviewedAt ? doc.reviewedAt.toISOString() : null,
      reviewReasonCode: doc.reviewReasonCode,
      reviewNotes: doc.reviewNotes,
      scanResult: doc.scanResult,
    };
  }
}

function sanitizeFilename(name: string): string {
  // Strip path components and non-printable characters, cap length.
  const base = name.split(/[/\\]/).pop() ?? 'file';
  return base.replace(/[^\w.\- ]+/g, '_').slice(0, 255);
}
