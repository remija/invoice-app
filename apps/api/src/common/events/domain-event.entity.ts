import { Prisma } from '@prisma/client';

export interface DomainEventData {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
  userId: string;
}
