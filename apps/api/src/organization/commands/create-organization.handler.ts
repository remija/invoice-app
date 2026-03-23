import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventLogService } from '../../common/events/event-log.handler';
import { CreateOrganizationCommand } from './create-organization.command';
import { OrganizationCreatedEvent } from '../events/organization-created.event';

@CommandHandler(CreateOrganizationCommand)
export class CreateOrganizationHandler
  implements ICommandHandler<CreateOrganizationCommand>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateOrganizationCommand) {
    const existing = await this.prisma.organization.findUnique({
      where: { siren: command.siren },
    });

    if (existing) {
      throw new ConflictException(
        `Organization with SIREN ${command.siren} already exists`,
      );
    }

    const organization = await this.prisma.organization.create({
      data: {
        name: command.name,
        siren: command.siren,
        siret: command.siret,
        vatNumber: command.vatNumber,
        address: command.address,
        legalForm: command.legalForm,
        capital: command.capital,
        rcsCity: command.rcsCity,
        cognitoUserId: command.userId,
      },
    });

    const event = new OrganizationCreatedEvent(
      organization.id,
      command.userId,
      {
        name: organization.name,
        siren: organization.siren,
        siret: organization.siret,
        legalForm: organization.legalForm,
      },
    );

    await this.eventLog.persist({
      aggregateType: 'Organization',
      aggregateId: organization.id,
      eventType: 'OrganizationCreated',
      payload: event.data,
      userId: command.userId,
    });

    this.eventBus.publish(event);

    return organization;
  }
}
