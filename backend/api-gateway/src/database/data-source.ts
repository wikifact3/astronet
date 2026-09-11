import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Customer } from './entities/customer.entity';
import { Account } from './entities/account.entity';
import { Plan } from './entities/plan.entity';
import { Subscription } from './entities/subscription.entity';
import { Invoice } from './entities/invoice.entity';
import { Payment } from './entities/payment.entity';
import { Ticket } from './entities/ticket.entity';
import { StaffUser } from './entities/staff-user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { Device } from './entities/device.entity';
import { AuditLog } from './entities/audit-log.entity';
import { CoverageGeoData } from './entities/coverage-geo-data.entity';
import { Notification } from './entities/notification.entity';
import { Lead } from './entities/lead.entity';
import { InitialSchema1740000000000 } from './migrations/1740000000000-InitialSchema';
import { AddUniqueConstraints1740000000001 } from './migrations/1740000000001-AddUniqueConstraints';
import { CreateLeads1740000000002 } from './migrations/1740000000002-CreateLeads';

config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'powerlink_core',
  entities: [
    Customer, Account, Plan, Subscription, Invoice, Payment,
    Ticket, StaffUser, Role, Permission, Device, AuditLog,  
    CoverageGeoData, Notification, Lead,
  ],
  migrations: [
    InitialSchema1740000000000,
    AddUniqueConstraints1740000000001,
    CreateLeads1740000000002,
  ],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  connectTimeoutMS: 5000,
  extra: { max: 10, connectionTimeoutMillis: 5000 },
});

export default AppDataSource;
