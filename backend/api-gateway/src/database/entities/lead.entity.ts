import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum LeadStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  CONTACTED = 'contacted',
  CONVERTED = 'converted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

@Entity({ schema: 'powerlink_core', name: 'leads' })
@Index(['phone'])
@Index(['status'])
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'draft_token', type: 'varchar', length: 64, unique: true })
  draftToken: string;

  @Column({
    type: 'enum',
    enum: LeadStatus,
    enumName: 'lead_status',
    default: LeadStatus.DRAFT,
  })
  status: LeadStatus;

  @Column({ name: 'full_name', type: 'varchar', length: 255, nullable: true })
  fullName: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  province: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  district: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  municipality: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  ward: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  street: string | null;

  @Column({ name: 'gps_lat', type: 'numeric', precision: 10, scale: 7, nullable: true })
  gpsLat: string | null;

  @Column({ name: 'gps_lng', type: 'numeric', precision: 10, scale: 7, nullable: true })
  gpsLng: string | null;

  @Column({ name: 'preferred_plan_id', type: 'uuid', nullable: true })
  preferredPlanId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'reference_id', type: 'varchar', length: 20, unique: true, nullable: true })
  referenceId: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}