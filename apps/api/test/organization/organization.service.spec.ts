import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrganizationService } from '../../src/organization/organization.service';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { CreateOrganizationDto } from '../../src/organization/dto/create-organization.dto';
import { UpdateOrganizationDto } from '../../src/organization/dto/update-organization.dto';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let prisma: jest.Mocked<PrismaService>;

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

  // Mock transaction client that mirrors prisma delegates
  const mockTx = {
    organization: {
      create: jest.fn(),
      update: jest.fn(),
    },
    domainEvent: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    // Reset all mocks
    mockTx.organization.create.mockReset();
    mockTx.organization.update.mockReset();
    mockTx.domainEvent.create.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: PrismaService,
          useValue: {
            organization: {
              findUnique: jest.fn(),
            },
            $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
          },
        },
      ],
    }).compile();

    service = module.get(OrganizationService);
    prisma = module.get(PrismaService);
  });

  describe('create', () => {
    it('should create organization and audit event in a transaction', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
      mockTx.organization.create.mockResolvedValue(mockOrganization);
      mockTx.domainEvent.create.mockResolvedValue({});

      const result = await service.create('user-123', createDto);

      expect(result).toEqual(mockOrganization);
      expect(mockTx.organization.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Mon Entreprise',
          siren: '123456789',
          cognitoUserId: 'user-123',
        }),
      });
      expect(mockTx.domainEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          aggregateType: 'Organization',
          aggregateId: 'org-1',
          eventType: 'OrganizationCreated',
          userId: 'user-123',
        }),
      });
    });

    it('should reject duplicate SIREN', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrganization);

      await expect(service.create('user-123', createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
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
    it('should update organization and persist audit event in a transaction', async () => {
      const updatedOrg = { ...mockOrganization, name: 'Nouveau Nom' };
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrganization);
      mockTx.organization.update.mockResolvedValue(updatedOrg);
      mockTx.domainEvent.create.mockResolvedValue({});

      const dto: UpdateOrganizationDto = { name: 'Nouveau Nom' };
      const result = await service.update('user-123', dto);

      expect(result.name).toBe('Nouveau Nom');
      expect(mockTx.domainEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          aggregateType: 'Organization',
          eventType: 'OrganizationUpdated',
          payload: { name: 'Nouveau Nom' },
        }),
      });
    });

    it('should throw NotFoundException if organization does not exist', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);

      const dto: UpdateOrganizationDto = { name: 'Test' };
      await expect(service.update('wrong-user', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return existing org without transaction if no fields to update', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrganization);

      const dto: UpdateOrganizationDto = {};
      const result = await service.update('user-123', dto);

      expect(result).toEqual(mockOrganization);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
