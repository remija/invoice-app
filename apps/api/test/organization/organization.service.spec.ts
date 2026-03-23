import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrganizationService } from '../../src/organization/organization.service';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { EventLogService } from '../../src/common/events/event-log.handler';
import { CreateOrganizationDto } from '../../src/organization/dto/create-organization.dto';
import { UpdateOrganizationDto } from '../../src/organization/dto/update-organization.dto';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let prisma: jest.Mocked<PrismaService>;
  let eventLog: jest.Mocked<EventLogService>;

  const createDto: CreateOrganizationDto = {
    name: 'Mon Entreprise',
    siren: '123456789',
    siret: '12345678900001',
    address: { street: '1 rue de la Paix', city: 'Paris', zip: '75001', country: 'FR' },
    legalForm: 'micro-entrepreneur',
  };

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
        OrganizationService,
        {
          provide: PrismaService,
          useValue: {
            organization: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
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
      ],
    }).compile();

    service = module.get(OrganizationService);
    prisma = module.get(PrismaService);
    eventLog = module.get(EventLogService);
  });

  describe('create', () => {
    it('should create an organization with all fields', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.organization.create as jest.Mock).mockResolvedValue(mockOrganization);

      const result = await service.create('user-123', createDto);

      expect(result).toEqual(mockOrganization);
      expect(prisma.organization.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Mon Entreprise',
          siren: '123456789',
          cognitoUserId: 'user-123',
        }),
      });
    });

    it('should persist event in audit log', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.organization.create as jest.Mock).mockResolvedValue(mockOrganization);

      await service.create('user-123', createDto);

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

      await expect(service.create('user-123', createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.organization.create).not.toHaveBeenCalled();
    });
  });

  describe('findByUser', () => {
    it('should return organization for user', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrganization);

      const result = await service.findByUser('user-123');

      expect(result).toEqual(mockOrganization);
    });

    it('should throw NotFoundException if not found', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findByUser('user-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update organization name', async () => {
      const updatedOrg = { ...mockOrganization, name: 'Nouveau Nom' };
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrganization);
      (prisma.organization.update as jest.Mock).mockResolvedValue(updatedOrg);

      const dto: UpdateOrganizationDto = { name: 'Nouveau Nom' };
      const result = await service.update('user-123', dto);

      expect(result.name).toBe('Nouveau Nom');
    });

    it('should persist update event in audit log', async () => {
      const updatedOrg = { ...mockOrganization, name: 'Nouveau Nom' };
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrganization);
      (prisma.organization.update as jest.Mock).mockResolvedValue(updatedOrg);

      const dto: UpdateOrganizationDto = { name: 'Nouveau Nom' };
      await service.update('user-123', dto);

      expect(eventLog.persist).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregateType: 'Organization',
          eventType: 'OrganizationUpdated',
          payload: { name: 'Nouveau Nom' },
        }),
      );
    });

    it('should throw NotFoundException if organization does not exist', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);

      const dto: UpdateOrganizationDto = { name: 'Test' };
      await expect(service.update('wrong-user', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return existing org without DB call if no fields to update', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrganization);

      const dto: UpdateOrganizationDto = {};
      const result = await service.update('user-123', dto);

      expect(result).toEqual(mockOrganization);
      expect(prisma.organization.update).not.toHaveBeenCalled();
      expect(eventLog.persist).not.toHaveBeenCalled();
    });
  });
});
