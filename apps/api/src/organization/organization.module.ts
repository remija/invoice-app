import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { OrganizationController } from './organization.controller';
import { CreateOrganizationHandler } from './commands/create-organization.handler';
import { UpdateOrganizationHandler } from './commands/update-organization.handler';
import { GetOrganizationHandler } from './queries/get-organization.handler';
import { AuthModule } from '../auth/auth.module';

const CommandHandlers = [CreateOrganizationHandler, UpdateOrganizationHandler];
const QueryHandlers = [GetOrganizationHandler];

@Module({
  imports: [CqrsModule, AuthModule],
  controllers: [OrganizationController],
  providers: [...CommandHandlers, ...QueryHandlers],
})
export class OrganizationModule {}
