import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DomainEventData } from './domain-event.entity';

@Injectable()
export class EventLogService {
  private readonly logger = new Logger(EventLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async persist(event: DomainEventData): Promise<void> {
    await this.prisma.domainEvent.create({
      data: {
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload,
        userId: event.userId,
      },
    });
    this.logger.log(
      `Event persisted: ${event.eventType} for ${event.aggregateType}#${event.aggregateId}`,
    );
  }

  async findByAggregate(aggregateType: string, aggregateId: string) {
    return this.prisma.domainEvent.findMany({
      where: { aggregateType, aggregateId },
      orderBy: { occurredAt: 'asc' },
    });
  }

  async findByEventType(eventType: string, since?: Date) {
    return this.prisma.domainEvent.findMany({
      where: {
        eventType,
        ...(since && { occurredAt: { gte: since } }),
      },
      orderBy: { occurredAt: 'asc' },
    });
  }
}
