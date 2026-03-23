import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Organization } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { EventLogService } from '../common/events/event-log.handler';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
  ) {}

  async create(
    userId: string,
    dto: CreateOrganizationDto,
  ): Promise<Organization> {
    const existing = await this.prisma.organization.findUnique({
      where: { siren: dto.siren },
    });

    if (existing) {
      throw new ConflictException(
        `Organization with SIREN ${dto.siren} already exists`,
      );
    }

    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name,
        siren: dto.siren,
        siret: dto.siret,
        vatNumber: dto.vatNumber,
        address: { ...dto.address },
        legalForm: dto.legalForm,
        capital: dto.capital,
        rcsCity: dto.rcsCity,
        cognitoUserId: userId,
      },
    });

    await this.eventLog.persist({
      aggregateType: 'Organization',
      aggregateId: organization.id,
      eventType: 'OrganizationCreated',
      payload: {
        name: organization.name,
        siren: organization.siren,
        siret: organization.siret,
        legalForm: organization.legalForm,
      },
      userId,
    });

    return organization;
  }

  async findByUser(userId: string): Promise<Organization> {
    const organization = await this.prisma.organization.findUnique({
      where: { cognitoUserId: userId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async update(
    userId: string,
    dto: UpdateOrganizationDto,
  ): Promise<Organization> {
    const existing = await this.prisma.organization.findUnique({
      where: { cognitoUserId: userId },
    });

    if (!existing) {
      throw new NotFoundException('Organization not found');
    }

    const data: Record<string, string | object> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.siret !== undefined) data.siret = dto.siret;
    if (dto.vatNumber !== undefined) data.vatNumber = dto.vatNumber;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.legalForm !== undefined) data.legalForm = dto.legalForm;
    if (dto.capital !== undefined) data.capital = dto.capital;
    if (dto.rcsCity !== undefined) data.rcsCity = dto.rcsCity;

    if (Object.keys(data).length === 0) {
      return existing;
    }

    const organization = await this.prisma.organization.update({
      where: { id: existing.id },
      data,
    });

    await this.eventLog.persist({
      aggregateType: 'Organization',
      aggregateId: organization.id,
      eventType: 'OrganizationUpdated',
      payload: data,
      userId,
    });

    return organization;
  }
}
