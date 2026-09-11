import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ schema: 'powerlink_core', name: 'coverage_geo_data' })
@Index(['province', 'district', 'municipality', 'ward'])
export class CoverageGeoData extends BaseEntity {
  @Column({ length: 100 })
  province: string;

  @Column({ length: 100 })
  district: string;

  @Column({ length: 100 })
  municipality: string;

  @Column({ length: 20 })
  ward: string;

  @Column({ name: 'coverage_status', length: 50 })
  coverageStatus: string;

  @Column({ name: 'estimated_availability_quarter', length: 20, nullable: true })
  estimatedAvailabilityQuarter: string;

  @Column({ name: 'gps_bounds', type: 'jsonb', nullable: true })
  gpsBounds: object;

  @Column({ type: 'jsonb', nullable: true })
  details: object;

  @Column({ name: 'last_updated_at', type: 'timestamptz', default: () => 'NOW()' })
  lastUpdatedAt: Date;
}
