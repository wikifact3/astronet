import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ schema: 'powerlink_core', name: 'permissions' })
export class Permission extends BaseEntity {
  @Column({ length: 100 })
  resource: string;

  @Column({ length: 50 })
  action: string;
}
