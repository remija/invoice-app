import { IEvent } from '@nestjs/cqrs';
import { Prisma } from '@prisma/client';

export class OrganizationUpdatedEvent implements IEvent {
  constructor(
    public readonly organizationId: string,
    public readonly userId: string,
    public readonly changes: Prisma.InputJsonValue,
  ) {}
}
