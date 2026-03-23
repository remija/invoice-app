import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from './common/prisma/prisma.module';
import { EventLogModule } from './common/events/event-log.module';
import { SqsModule } from './common/sqs/sqs.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationModule } from './organization/organization.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CqrsModule.forRoot(),
    PrismaModule,
    EventLogModule,
    SqsModule,
    AuthModule,
    OrganizationModule,
  ],
})
export class AppModule {}
