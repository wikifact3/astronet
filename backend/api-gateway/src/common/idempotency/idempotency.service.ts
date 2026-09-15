import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { IdempotencyKey } from './idempotency.entity';

export interface CachedResponse {
  body: object;
  status: number;
}

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
  ) {}

  async get(scope: string, key: string): Promise<CachedResponse | null> {
    const row = await this.repo.findOne({
      where: { key: `${scope}:${key}` },
    });
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) {
      await this.repo.delete({ key: row.key });
      return null;
    }
    return { body: row.responseBody, status: row.responseStatus };
  }

  async store(
    scope: string,
    key: string,
    body: object,
    status: number,
    ttlSeconds = 86400,
  ): Promise<void> {
    const fullKey = `${scope}:${key}`;
    await this.repo.upsert(
      {
        key: fullKey,
        scope,
        responseBody: body,
        responseStatus: status,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      },
      ['key'],
    );
  }

  async purgeExpired(): Promise<number> {
    const result = await this.repo.delete({ expiresAt: LessThan(new Date()) });
    return result.affected ?? 0;
  }
}
