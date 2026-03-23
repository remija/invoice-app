import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '@nestjs/cqrs';
import { ConflictException } from '@nestjs/common';
import { CreateOrganizationHandler } from '../../src/organization/commands/create-organization.handler';
import { CreateOrganizationCommand } from '../../src/organization/commands/create-organization.command';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { EventLogService } from '../../src/common/events/event-log.handler';

describe('CreateOrganizationHandler', () => {
  let handler: CreateOrganizationHandler;
  let prisma: jest.Mocked<PrismaService>;
  let eventLog: jest.Mocked<EventLogService>;
  let eventBus: jest.Mocked<EventBus>;

  const mockCommand = new CreateOrganizationCommand(
    'user-123',
    'Mon Entreprise',
    '123456789',
    '12345678900001',
    { street: '1 rue de la Paix', city: 'Paris', zip: '75001', country: 'FR' },
    'micro-entrepreneur',
    undefined,
    undefined,
    undefined,
  );

  const mockOrganization = {
    id: 'org-1',
    name: 'Mon Entreprise',
    siren: '123456789',
    siret: '12345678900001',
    vatNumber: null,
    address: { street: '1 rue de la Paix', city: 'Paris', zip: '75001', country: 'FR' },
    legalForm: 'micro-entrepreneur',
    capital: null,
    rcsCity: null,
    subscriptionTier: 'free',
    stripeCustomerId: null,
    cognitoUserId: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateOrganizationHandler,
        {
          provide: PrismaService,
          useValue: {
            organization: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        {
          provide: EventLogService,
          useValue: {
            persist: jest.fn(),
          },
        },
        {
          provide: EventBus,
          useValue: {
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    handler = module.get(CreateOrganizationHandler);
    prisma = module.get(PrismaService);
    eventLog = module.get(EventLogService);
    eventBus = module.get(EventBus);
  });

  it('should create an organization with all fields', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.organization.create as jest.Mock).mockResolvedValue(mockOrganization);

    const result = await handler.execute(mockCommand);

    expect(result).toEqual(mockOrganization);
    expect(prisma.organization.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Mon Entreprise',
        siren: '123456789',
        siret: '12345678900001',
        legalForm: 'micro-entrepreneur',
        cognitoUserId: 'user-123',
      }),
    });
  });

  it('should emit OrganizationCreatedEvent', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.organization.create as jest.Mock).mockResolvedValue(mockOrganization);

    await handler.execute(mockCommand);

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-123',
      }),
    );
  });

  it('should persist event in audit log', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.organization.create as jest.Mock).mockResolvedValue(mockOrganization);

    await handler.execute(mockCommand);

    expect(eventLog.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: 'Organization',
        aggregateId: 'org-1',
        eventType: 'OrganizationCreated',
        userId: 'user-123',
      }),
    );
  });

  it('should reject duplicate SIREN', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrganization);

    await expect(handler.execute(mockCommand)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.organization.create).not.toHaveBeenCalled();
  });
});
