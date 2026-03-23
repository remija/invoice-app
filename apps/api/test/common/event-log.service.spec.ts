import { Test, TestingModule } from '@nestjs/testing';
import { EventLogService } from '../../src/common/events/event-log.service';
import { PrismaService } from '../../src/common/prisma/prisma.service';

describe('EventLogService', () => {
  let service: EventLogService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventLogService,
        {
          provide: PrismaService,
          useValue: {
            domainEvent: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get(EventLogService);
    prisma = module.get(PrismaService);
  });

  describe('persist', () => {
    it('should create a domain event in the database', async () => {
      const eventData = {
        aggregateType: 'Invoice',
        aggregateId: 'inv-1',
        eventType: 'InvoiceCreated',
        payload: { number: '2026-001', totalTtc: 1200 },
        userId: 'user-123',
      };

      (prisma.domainEvent.create as jest.Mock).mockResolvedValue({
        id: 'evt-1',
        ...eventData,
        occurredAt: new Date(),
      });

      await service.persist(eventData);

      expect(prisma.domainEvent.create).toHaveBeenCalledWith({
        data: eventData,
      });
    });
  });

  describe('findByAggregate', () => {
    it('should return events ordered by occurredAt', async () => {
      const events = [
        { id: 'evt-1', eventType: 'InvoiceCreated', occurredAt: new Date('2026-01-01') },
        { id: 'evt-2', eventType: 'InvoiceSent', occurredAt: new Date('2026-01-02') },
      ];
      (prisma.domainEvent.findMany as jest.Mock).mockResolvedValue(events);

      const result = await service.findByAggregate('Invoice', 'inv-1');

      expect(result).toEqual(events);
      expect(prisma.domainEvent.findMany).toHaveBeenCalledWith({
        where: { aggregateType: 'Invoice', aggregateId: 'inv-1' },
        orderBy: { occurredAt: 'asc' },
      });
    });
  });

  describe('findByEventType', () => {
    it('should filter by event type with optional since date', async () => {
      const since = new Date('2026-01-01');
      (prisma.domainEvent.findMany as jest.Mock).mockResolvedValue([]);

      await service.findByEventType('InvoiceCreated', since);

      expect(prisma.domainEvent.findMany).toHaveBeenCalledWith({
        where: {
          eventType: 'InvoiceCreated',
          occurredAt: { gte: since },
        },
        orderBy: { occurredAt: 'asc' },
      });
    });

    it('should work without since parameter', async () => {
      (prisma.domainEvent.findMany as jest.Mock).mockResolvedValue([]);

      await service.findByEventType('InvoiceCreated');

      expect(prisma.domainEvent.findMany).toHaveBeenCalledWith({
        where: { eventType: 'InvoiceCreated' },
        orderBy: { occurredAt: 'asc' },
      });
    });
  });
});
