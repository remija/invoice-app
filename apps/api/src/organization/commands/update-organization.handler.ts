import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventLogService } from '../../common/events/event-log.handler';
import { UpdateOrganizationCommand } from './update-organization.command';
import { OrganizationUpdatedEvent } from '../events/organization-updated.event';

@CommandHandler(UpdateOrganizationCommand)
export class UpdateOrganizationHandler
  implements ICommandHandler<UpdateOrganizationCommand>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: UpdateOrganizationCommand) {
    const existing = await this.prisma.organization.findFirst({
      where: {
        id: command.organizationId,
        cognitoUserId: command.userId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Organization not found');
    }

    const data: Record<string, string | object> = {};
    if (command.name !== undefined) data.name = command.name;
    if (command.siret !== undefined) data.siret = command.siret;
    if (command.vatNumber !== undefined) data.vatNumber = command.vatNumber;
    if (command.address !== undefined) data.address = command.address;
    if (command.legalForm !== undefined) data.legalForm = command.legalForm;
    if (command.capital !== undefined) data.capital = command.capital;
    if (command.rcsCity !== undefined) data.rcsCity = command.rcsCity;

    const organization = await this.prisma.organization.update({
      where: { id: command.organizationId },
      data,
    });

    const event = new OrganizationUpdatedEvent(
      organization.id,
      command.userId,
      data,
    );

    await this.eventLog.persist({
      aggregateType: 'Organization',
      aggregateId: organization.id,
      eventType: 'OrganizationUpdated',
      payload: data,
      userId: command.userId,
    });

    this.eventBus.publish(event);

    return organization;
  }
}
