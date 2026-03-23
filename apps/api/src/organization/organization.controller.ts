import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/cognito-auth.guard';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CreateOrganizationCommand } from './commands/create-organization.command';
import { UpdateOrganizationCommand } from './commands/update-organization.command';
import { GetOrganizationQuery } from './queries/get-organization.query';

@ApiTags('Organization')
@ApiBearerAuth()
@UseGuards(CognitoAuthGuard)
@Controller('organizations')
export class OrganizationController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.commandBus.execute(
      new CreateOrganizationCommand(
        user.userId,
        dto.name,
        dto.siren,
        dto.siret,
        dto.address,
        dto.legalForm,
        dto.vatNumber,
        dto.capital,
        dto.rcsCity,
      ),
    );
  }

  @Get('me')
  async getMyOrganization(@CurrentUser() user: AuthenticatedUser) {
    return this.queryBus.execute(new GetOrganizationQuery(user.userId));
  }

  @Patch('me')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOrganizationDto,
  ) {
    const org = await this.queryBus.execute(
      new GetOrganizationQuery(user.userId),
    );
    return this.commandBus.execute(
      new UpdateOrganizationCommand(
        org.id,
        user.userId,
        dto.name,
        dto.siret,
        dto.vatNumber,
        dto.address,
        dto.legalForm,
        dto.capital,
        dto.rcsCity,
      ),
    );
  }
}
