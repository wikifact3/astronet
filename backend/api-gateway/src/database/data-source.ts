import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Customer } from './entities/customer.entity';
import { Account } from './entities/account.entity';
import { Plan } from './entities/plan.entity';
import { Subscription } from './entities/subscription.entity';
import { Invoice } from './entities/invoice.entity';
import { Payment } from './entities/payment.entity';
import { Ticket } from './entities/ticket.entity';
import { TicketMessage } from './entities/ticket-message.entity';
import { StaffUser } from './entities/staff-user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { Device } from './entities/device.entity';
import { AuditLog } from './entities/audit-log.entity';
import { CoverageGeoData } from './entities/coverage-geo-data.entity';
import { Notification } from './entities/notification.entity';
import { Lead } from './entities/lead.entity';
import { KycDocument } from './entities/kyc-document.entity';
import { KycUploadSession } from './entities/kyc-upload-session.entity';
import { OtpCode } from './entities/otp-code.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { OtpRequestLog } from './entities/otp-request-log.entity';
import { IdempotencyKey } from '../common/idempotency/idempotency.entity';
import { InitialSchema1740000000000 } from './migrations/1740000000000-InitialSchema';
import { AddUniqueConstraints1740000000001 } from './migrations/1740000000001-AddUniqueConstraints';
import { CreateLeads1740000000002 } from './migrations/1740000000002-CreateLeads';
import { CreateOtpCodes1740000000003 } from './migrations/1740000000003-CreateOtpCodes';
import { CreateRefreshTokens1740000000004 } from './migrations/1740000000004-CreateRefreshTokens';
import { AddOtpIpIndex1740000000005 } from './migrations/1740000000005-AddOtpIpIndex';
import { CreateOtpRequestLog1740000000006 } from './migrations/1740000000006-CreateOtpRequestLog';
import { PaymentFlowFields1740000000007 } from './migrations/1740000000007-PaymentFlowFields';
import { OneIssuedInvoicePerSubscription1740000000008 } from './migrations/1740000000008-OneIssuedInvoicePerSubscription';
import { StaffAuth1740000000009 } from './migrations/1740000000009-StaffAuth';
import { RefreshTokensSubjectType1740000000010 } from './migrations/1740000000010-RefreshTokensSubjectType';
import { DropRefreshTokensCustomerFk1740000000011 } from './migrations/1740000000011-DropRefreshTokensCustomerFk';
import { KycUploadPipeline1740000000012 } from './migrations/1740000000012-KycUploadPipeline';
import { AccountStatusTransitions1740000000013 } from './migrations/1740000000013-AccountStatusTransitions';

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
    Ticket, TicketMessage, StaffUser, Role, Permission, Device, AuditLog,  
    CoverageGeoData, Notification, Lead, KycDocument, KycUploadSession, OtpCode, RefreshToken, OtpRequestLog, IdempotencyKey, 
  ],
  migrations: [
    InitialSchema1740000000000,
    AddUniqueConstraints1740000000001,
    CreateLeads1740000000002,
    CreateOtpCodes1740000000003,
    CreateRefreshTokens1740000000004,
    AddOtpIpIndex1740000000005,
    CreateOtpRequestLog1740000000006,
    PaymentFlowFields1740000000007,
    OneIssuedInvoicePerSubscription1740000000008,
    StaffAuth1740000000009,
    RefreshTokensSubjectType1740000000010,
    DropRefreshTokensCustomerFk1740000000011,
    KycUploadPipeline1740000000012,
    AccountStatusTransitions1740000000013,
  ],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  connectTimeoutMS: 5000,
  extra: { max: 10, connectionTimeoutMillis: 5000 },
});

export default AppDataSource;
