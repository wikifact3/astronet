import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Role } from './role.entity';

@Entity({ schema: 'powerlink_core', name: 'staff_users' })
export class StaffUser extends BaseEntity {
  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ name: 'full_name', length: 255 })
  fullName: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({ name: 'role_id' })
  roleId: string;

  @Column({ name: 'ward_access', type: 'text', array: true, nullable: true })
  wardAccess: string[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', nullable: true })
  lastLoginAt: Date;
}
