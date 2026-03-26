import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClientService } from '../../src/client/client.service';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { SireneService } from '../../src/common/sirene/sirene.service';
import { CreateClientDto } from '../../src/client/dto/create-client.dto';

describe('ClientService', () => {
  let service: ClientService;
  let prisma: jest.Mocked<PrismaService>;

  const mockTx = {
    client: {
      create: jest.fn(),
      update: jest.fn(),
    },
    domainEvent: {
      create: jest.fn(),
    },
  };

  const mockClient = {
    id: 'client-1',
    organizationId: 'org-1',
    name: 'Acme Corp',
    email: 'contact@acme.fr',
    siren: '123456789',
    siret: null,
    vatNumber: null,
    billingAddress: { street: '1 rue de la Paix', city: 'Paris', zip: '75001', country: 'FR' },
    deliveryAddress: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createDto: CreateClientDto = {
    name: 'Acme Corp',
    email: 'contact@acme.fr',
    siren: '123456789',
    billingAddress: { street: '1 rue de la Paix', city: 'Paris', zip: '75001', country: 'FR' },
  };

  beforeEach(async () => {
    mockTx.client.create.mockReset();
    mockTx.client.update.mockReset();
    mockTx.domainEvent.create.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientService,
        {
          provide: PrismaService,
          useValue: {
            client: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
            },
            $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
          },
        },
        {
          provide: SireneService,
          useValue: { search: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ClientService);
    prisma = module.get(PrismaService);
  });

  describe('create', () => {
    it('should create client and audit event in a transaction', async () => {
      (prisma.client.findFirst as jest.Mock).mockResolvedValue(null);
      mockTx.client.create.mockResolvedValue(mockClient);
      mockTx.domainEvent.create.mockResolvedValue({});

      const result = await service.create('org-1', 'user-1', createDto);

      expect(result).toEqual(mockClient);
      expect(mockTx.client.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          name: 'Acme Corp',
          siren: '123456789',
        }),
      });
      expect(mockTx.domainEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          aggregateType: 'Client',
          aggregateId: 'client-1',
          eventType: 'ClientCreated',
          userId: 'user-1',
        }),
      });
    });

    it('should reject duplicate SIREN within the same organization', async () => {
      (prisma.client.findFirst as jest.Mock).mockResolvedValue(mockClient);

      await expect(service.create('org-1', 'user-1', createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return non-deleted clients for the organization', async () => {
      (prisma.client.findMany as jest.Mock).mockResolvedValue([mockClient]);

      const result = await service.findAll('org-1');

      expect(result).toEqual([mockClient]);
      expect(prisma.client.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return the client', async () => {
      (prisma.client.findFirst as jest.Mock).mockResolvedValue(mockClient);

      const result = await service.findOne('org-1', 'client-1');
      expect(result).toEqual(mockClient);
    });

    it('should throw NotFoundException when client does not exist', async () => {
      (prisma.client.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('org-1', 'client-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when client belongs to another organization', async () => {
      (prisma.client.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('other-org', 'client-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update client and write audit event', async () => {
      const updatedClient = { ...mockClient, name: 'Nouveau Nom' };
      (prisma.client.findFirst as jest.Mock).mockResolvedValue(mockClient);
      mockTx.client.update.mockResolvedValue(updatedClient);
      mockTx.domainEvent.create.mockResolvedValue({});

      const result = await service.update('org-1', 'user-1', 'client-1', { name: 'Nouveau Nom' });

      expect(result.name).toBe('Nouveau Nom');
      expect(mockTx.domainEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'ClientUpdated',
          payload: { name: 'Nouveau Nom' },
        }),
      });
    });

    it('should throw NotFoundException when client does not exist', async () => {
      (prisma.client.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('org-1', 'user-1', 'client-1', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when client belongs to another organization', async () => {
      (prisma.client.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('other-org', 'user-1', 'client-1', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft-delete client and write ClientArchived event', async () => {
      const archivedClient = { ...mockClient, deletedAt: new Date() };
      (prisma.client.findFirst as jest.Mock).mockResolvedValue(mockClient);
      mockTx.client.update.mockResolvedValue(archivedClient);
      mockTx.domainEvent.create.mockResolvedValue({});

      const result = await service.remove('org-1', 'user-1', 'client-1');

      expect(result.deletedAt).not.toBeNull();
      expect(mockTx.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(mockTx.domainEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'ClientArchived',
        }),
      });
    });

    it('should throw NotFoundException when client does not exist', async () => {
      (prisma.client.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.remove('org-1', 'user-1', 'client-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when client belongs to another organization', async () => {
      (prisma.client.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.remove('other-org', 'user-1', 'client-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
