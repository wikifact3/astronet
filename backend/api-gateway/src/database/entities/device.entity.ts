import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Account } from './account.entity';

@Entity({ schema: 'powerlink_core', name: 'devices' })
export class Device extends BaseEntity {
  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ name: 'account_id' })
  accountId: string;

  @Column({ name: 'onu_serial', unique: true, length: 50 })
  onuSerial: string;

  @Column({ name: 'olt_id', length: 50 })
  oltId: string;

  @Column({ name: 'olt_port', length: 20 })
  oltPort: string;

  @Column({ name: 'radius_profile_id', length: 50, nullable: true })
  radiusProfileId: string;

  @Column({ name: 'device_model', length: 100, nullable: true })
  deviceModel: string;

  @Column({ name: 'firmware_version', length: 50, nullable: true })
  firmwareVersion: string;

  @Column({ name: 'last_seen_at', nullable: true })
  lastSeenAt: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
