import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { UpdateOrganizationHandler } from '../../src/organization/commands/update-organization.handler';
import { UpdateOrganizationCommand } from '../../src/organization/commands/update-organization.command';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { EventLogService } from '../../src/common/events/event-log.handler';

describe('UpdateOrganizationHandler', () => {
  let handler: UpdateOrganizationHandler;
  let prisma: jest.Mocked<PrismaService>;
  let eventLog: jest.Mocked<EventLogService>;
  let eventBus: jest.Mocked<EventBus>;

  const existingOrg = {
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
        UpdateOrganizationHandler,
        {
          provide: PrismaService,
          useValue: {
            organization: {
              findFirst: jest.fn(),
              update: jest.fn(),
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

    handler = module.get(UpdateOrganizationHandler);
    prisma = module.get(PrismaService);
    eventLog = module.get(EventLogService);
    eventBus = module.get(EventBus);
  });

  it('should update organization name', async () => {
    const updatedOrg = { ...existingOrg, name: 'Nouveau Nom' };
    (prisma.organization.findFirst as jest.Mock).mockResolvedValue(existingOrg);
    (prisma.organization.update as jest.Mock).mockResolvedValue(updatedOrg);

    const command = new UpdateOrganizationCommand('org-1', 'user-123', 'Nouveau Nom');
    const result = await handler.execute(command);

    expect(result.name).toBe('Nouveau Nom');
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: { name: 'Nouveau Nom' },
    });
  });

  it('should persist update event in audit log', async () => {
    const updatedOrg = { ...existingOrg, name: 'Nouveau Nom' };
    (prisma.organization.findFirst as jest.Mock).mockResolvedValue(existingOrg);
    (prisma.organization.update as jest.Mock).mockResolvedValue(updatedOrg);

    const command = new UpdateOrganizationCommand('org-1', 'user-123', 'Nouveau Nom');
    await handler.execute(command);

    expect(eventLog.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: 'Organization',
        eventType: 'OrganizationUpdated',
        payload: { name: 'Nouveau Nom' },
      }),
    );
  });

  it('should throw NotFoundException if organization does not exist', async () => {
    (prisma.organization.findFirst as jest.Mock).mockResolvedValue(null);

    const command = new UpdateOrganizationCommand('org-999', 'user-123', 'Test');
    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException if user does not own org', async () => {
    (prisma.organization.findFirst as jest.Mock).mockResolvedValue(null);

    const command = new UpdateOrganizationCommand('org-1', 'wrong-user', 'Test');
    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
  });
});
