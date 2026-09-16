import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import { HealthModule } from './modules/health/health.module';
import { CoverageModule } from './modules/coverage/coverage.module';
import { PlansModule } from './modules/plans/plans.module';
import { LeadsModule } from './modules/leads/leads.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { SmsModule } from './modules/sms/sms.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PaymentsModule } from './modules/payments/payments.module'; 
import { TicketsModule } from './modules/tickets/tickets.module';
import appConfig from './config/app.config';
import dbConfig from './config/db.config';
import redisConfig from './config/redis.config';
import paymentConfig from './config/payment.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, redisConfig, paymentConfig],
      envFilePath: ['.env', '../../.env'],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port', 5432),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        autoLoadEntities: true,

        migrations: [
          __dirname + '/database/migrations/**/*{.ts,.js}',
        ],

        synchronize: false,

        logging:
          configService.get<string>('environment') === 'development',
      }),
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port', 6379),
          password: configService.get<string>('redis.password'),
        },
      }),
    }),

    HealthModule,
    CoverageModule,
    PlansModule,
    LeadsModule,
    AuthModule,
    CustomersModule,
    SubscriptionsModule,
    SmsModule,
    InvoicesModule,
    PaymentsModule,
    TicketsModule, 
  ],
})
export class AppModule {}
