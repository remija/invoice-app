import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { BadGatewayException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { SireneService } from '../../src/common/sirene/sirene.service';

describe('SireneService', () => {
  let service: SireneService;
  let http: jest.Mocked<HttpService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SireneService,
        {
          provide: HttpService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(SireneService);
    http = module.get(HttpService);
  });

  it('should return mapped results on success', async () => {
    const fakeResponse: AxiosResponse = {
      data: {
        results: [
          {
            siren: '123456789',
            nom_complet: 'Ma Société SAS',
            matching_etablissements: [
              {
                numero_voie: '1',
                type_voie: 'RUE',
                libelle_voie: 'DE LA PAIX',
                libelle_commune: 'PARIS',
                code_postal: '75001',
              },
            ],
          },
        ],
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    };

    http.get.mockReturnValue(of(fakeResponse));

    const results = await service.search('Ma Société');

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      siren: '123456789',
      name: 'Ma Société SAS',
      address: {
        street: '1 RUE DE LA PAIX',
        city: 'PARIS',
        zip: '75001',
        country: 'France',
      },
    });
  });

  it('should return empty array when no results', async () => {
    const fakeResponse: AxiosResponse = {
      data: { results: [] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    };

    http.get.mockReturnValue(of(fakeResponse));

    const results = await service.search('inexistant');
    expect(results).toEqual([]);
  });

  it('should throw BadGatewayException on HTTP error', async () => {
    http.get.mockReturnValue(throwError(() => new Error('timeout')));

    await expect(service.search('test')).rejects.toThrow(BadGatewayException);
  });
});
