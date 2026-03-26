import { Injectable, BadGatewayException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SirenSearchResultDto } from '../../client/dto/siren-search-result.dto';

@Injectable()
export class SireneService {
  constructor(private readonly http: HttpService) {}

  async search(q: string): Promise<SirenSearchResultDto[]> {
    try {
      const response = await firstValueFrom(
        this.http.get('https://recherche-entreprises.api.gouv.fr/search', {
          params: { q, page: 1, per_page: 10 },
          timeout: 5000,
        }),
      );
      return this.mapResults(response.data.results ?? []);
    } catch {
      throw new BadGatewayException('Service Sirene INSEE indisponible');
    }
  }

  private mapResults(results: Record<string, unknown>[]): SirenSearchResultDto[] {
    return results.map((r) => {
      const matching = (r.matching_etablissements as Record<string, unknown>[])?.[0] ?? {};
      return {
        siren: r.siren as string,
        name: (r.nom_complet ?? r.nom_raison_sociale) as string,
        address: {
          street: [matching.numero_voie, matching.type_voie, matching.libelle_voie]
            .filter(Boolean)
            .join(' '),
          city: (matching.libelle_commune as string) ?? '',
          zip: (matching.code_postal as string) ?? '',
          country: (matching.libelle_pays_etranger as string) ?? 'France',
        },
      };
    });
  }
}
