import { IEvent } from '@nestjs/cqrs';
import { Prisma } from '@prisma/client';

export class OrganizationCreatedEvent implements IEvent {
  constructor(
    public readonly organizationId: string,
    public readonly userId: string,
    public readonly data: Prisma.InputJsonValue,
  ) {}
}
