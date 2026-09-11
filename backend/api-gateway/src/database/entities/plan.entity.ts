import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ schema: 'powerlink_core', name: 'plans' })
export class Plan extends BaseEntity {
  @Column({ length: 100, unique: true })
  name: string;

  @Column({ name: 'speed_mbps' })
  speedMbps: number;

  @Column({ name: 'base_price', type: 'decimal', precision: 12, scale: 2 })
  basePrice: number;

  @Column({ name: 'vat_rate', type: 'decimal', precision: 5, scale: 2, default: 13.00 })
  vatRate: number;

  @Column({ name: 'tsc_rate', type: 'decimal', precision: 5, scale: 2, default: 1.00 })
  tscRate: number;

  @Column({ name: 'fup_threshold_gb', nullable: true })
  fupThresholdGb: number;

  @Column({ name: 'bundle_addons', type: 'jsonb', default: [] })
  bundleAddons: object[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'display_order', default: 0 })
  displayOrder: number;
}
