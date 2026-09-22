import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';

export interface AuditEntry {
  actorId: string;
  actorType: 'staff' | 'customer' | 'system';
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.auditRepo.save(
        this.auditRepo.create({
          actorId: entry.actorId,
          actorType: entry.actorType,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          metadata: entry.metadata ?? null,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        }),
      );
    } catch (err) {
      // Never let an audit failure mask a business failure. Log loudly.
      this.logger.error(
        `Audit log write failed: ${(err as Error).message}`,
        entry,
      );
    }
  }

  async list(filter: {
    resourceType?: string;
    resourceId?: string;
    actorId?: string;
    limit?: number;
  }): Promise<AuditLog[]> {
    const qb = this.auditRepo
      .createQueryBuilder('a')
      .orderBy('a.timestamp', 'DESC')
      .limit(filter.limit ?? 100);

    if (filter.resourceType) {
      qb.andWhere('a.resource_type = :rt', { rt: filter.resourceType });
    }
    if (filter.resourceId) {
      qb.andWhere('a.resource_id = :ri', { ri: filter.resourceId });
    }
    if (filter.actorId) {
      qb.andWhere('a.actor_id = :aid', { aid: filter.actorId });
    }

    return qb.getMany();
  }
}
