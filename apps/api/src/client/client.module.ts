import { Module } from '@nestjs/common';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';
import { AuthModule } from '../auth/auth.module';
import { SireneModule } from '../common/sirene/sirene.module';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [AuthModule, SireneModule, OrganizationModule],
  controllers: [ClientController],
  providers: [ClientService],
  exports: [ClientService],
})
export class ClientModule {}
