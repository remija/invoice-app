import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Client, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { SireneService } from '../common/sirene/sirene.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { SirenSearchResultDto } from './dto/siren-search-result.dto';

@Injectable()
export class ClientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sirene: SireneService,
  ) {}

  async create(
    organizationId: string,
    userId: string,
    dto: CreateClientDto,
  ): Promise<Client> {
    if (dto.siren) {
      const existing = await this.prisma.client.findFirst({
        where: { organizationId, siren: dto.siren, deletedAt: null },
      });
      if (existing) {
        throw new ConflictException(
          `Un client avec le SIREN ${dto.siren} existe déjà`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          organizationId,
          name: dto.name,
          email: dto.email,
          siren: dto.siren,
          siret: dto.siret,
          vatNumber: dto.vatNumber,
          billingAddress: { ...dto.billingAddress },
          deliveryAddress: dto.deliveryAddress ? { ...dto.deliveryAddress } : undefined,
        },
      });

      await tx.domainEvent.create({
        data: {
          aggregateType: 'Client',
          aggregateId: client.id,
          eventType: 'ClientCreated',
          payload: { name: client.name, siren: client.siren },
          userId,
        },
      });

      return client;
    });
  }

  async findAll(organizationId: string): Promise<Client[]> {
    return this.prisma.client.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string): Promise<Client> {
    const client = await this.prisma.client.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    if (!client) {
      throw new NotFoundException('Client introuvable');
    }

    return client;
  }

  async update(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateClientDto,
  ): Promise<Client> {
    await this.findOne(organizationId, id);

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.siren !== undefined) data.siren = dto.siren;
    if (dto.siret !== undefined) data.siret = dto.siret;
    if (dto.vatNumber !== undefined) data.vatNumber = dto.vatNumber;
    if (dto.billingAddress !== undefined) data.billingAddress = { ...dto.billingAddress };
    if (dto.deliveryAddress !== undefined) data.deliveryAddress = { ...dto.deliveryAddress };

    if (Object.keys(data).length === 0) {
      return this.findOne(organizationId, id);
    }

    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.update({
        where: { id },
        data,
      });

      await tx.domainEvent.create({
        data: {
          aggregateType: 'Client',
          aggregateId: client.id,
          eventType: 'ClientUpdated',
          payload: data as Prisma.InputJsonValue,
          userId,
        },
      });

      return client;
    });
  }

  async remove(
    organizationId: string,
    userId: string,
    id: string,
  ): Promise<Client> {
    await this.findOne(organizationId, id);

    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.domainEvent.create({
        data: {
          aggregateType: 'Client',
          aggregateId: client.id,
          eventType: 'ClientArchived',
          payload: { deletedAt: client.deletedAt },
          userId,
        },
      });

      return client;
    });
  }

  async searchSirene(q: string): Promise<SirenSearchResultDto[]> {
    return this.sirene.search(q);
  }
}
