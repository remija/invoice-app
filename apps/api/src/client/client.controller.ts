import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { CognitoAuthGuard, AuthenticatedUser } from '../auth/cognito-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrganizationService } from '../organization/organization.service';
import { ClientService } from './client.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(CognitoAuthGuard)
@Controller('clients')
export class ClientController {
  constructor(
    private readonly clientService: ClientService,
    private readonly organizationService: OrganizationService,
  ) {}

  // IMPORTANT: /sirene/search must be declared BEFORE /:id
  // to prevent NestJS from matching "sirene" as an :id param
  @Get('sirene/search')
  @ApiQuery({ name: 'q', required: true, description: 'Nom ou SIREN à rechercher' })
  async searchSirene(@Query('q') q: string) {
    return this.clientService.searchSirene(q);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateClientDto,
  ) {
    const org = await this.organizationService.findByUser(user.userId);
    return this.clientService.create(org.id, user.userId, dto);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    const org = await this.organizationService.findByUser(user.userId);
    return this.clientService.findAll(org.id);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const org = await this.organizationService.findByUser(user.userId);
    return this.clientService.findOne(org.id, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    const org = await this.organizationService.findByUser(user.userId);
    return this.clientService.update(org.id, user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const org = await this.organizationService.findByUser(user.userId);
    return this.clientService.remove(org.id, user.userId, id);
  }
}
