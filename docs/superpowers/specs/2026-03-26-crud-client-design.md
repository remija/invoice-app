# Design — Module Client (Sprint 2)

> Date : 2026-03-26
> Scope : CRUD Client + lookup SIREN INSEE
> Sprint : 2

---

## Contexte

Le module Client permet aux micro-entrepreneurs de gérer leur carnet d'adresses clients. Le SIREN client devient obligatoire pour les factures B2B à partir de septembre 2026. Ce module est la première brique du cœur facturation.

---

## Décisions de design

| Décision | Choix | Raison |
|----------|-------|--------|
| Lookup SIREN | `SireneService` injecté séparément | Réutilisable dans le module Invoice (validation SIREN) |
| Suppression | Soft delete via `deletedAt` | Les clients liés à des factures ne peuvent pas être supprimés hard |
| Audit trail | `$transaction` entity + `DomainEvent` | Cohérent avec le pattern Organization, traçabilité complète |
| Cache Sirene | Aucun (Sprint 2) | Usage ponctuel, pas de gain réel à ce stade |
| Convention nommage events | PascalCase (`ClientCreated`) | Cohérent avec les events Organization existants (`OrganizationCreated`, etc.) |

---

## Structure des fichiers

```
apps/api/src/client/
├── dto/
│   ├── create-client.dto.ts
│   ├── update-client.dto.ts
│   └── siren-search-result.dto.ts
├── client.service.ts
├── client.controller.ts
└── client.module.ts

apps/api/src/common/sirene/
├── sirene.service.ts      # Appels API INSEE
└── sirene.module.ts       # Global, injectable partout
```

---

## Modification schema Prisma

Ajout du champ `deletedAt` et d'un index unique SIREN par organisation sur le modèle `Client` :

```prisma
model Client {
  // ... champs existants
  deletedAt DateTime?

  @@unique([organizationId, siren])  // SIREN unique par org (null exclu par PostgreSQL)
}
```

Migration nécessaire (`npm run db:migrate`). Toutes les requêtes filtrent sur `deletedAt: null`.

Note : PostgreSQL exclut nativement les `NULL` des contraintes `UNIQUE`, donc les clients sans SIREN ne sont pas affectés.

---

## Endpoints

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `POST` | `/clients` | Créer un client | Oui |
| `GET` | `/clients` | Lister les clients (org courante, non archivés) | Oui |
| `GET` | `/clients/:id` | Récupérer un client | Oui |
| `PATCH` | `/clients/:id` | Modifier un client | Oui |
| `DELETE` | `/clients/:id` | Archiver un client (soft delete) | Oui |
| `GET` | `/clients/sirene/search` | Recherche Sirene INSEE (`?q=nom_ou_siren`) | Oui |

**Note NestJS importante** : la route `/clients/sirene/search` doit être déclarée **avant** `/clients/:id` dans le contrôleur. NestJS résout les routes dans l'ordre de déclaration — sans cette précaution, `sirene/search` serait capturé par `/:id` avec `id = "sirene"`.

---

## SireneService

- Appelle `https://recherche-entreprises.api.gouv.fr/search?q=...` (API publique, sans clé)
- Retourne un tableau de `SirenSearchResult`
- Timeout : 5 secondes
- Toute réponse non-2xx de l'API INSEE ou timeout → propagation HTTP 502 au client
- Implémenté via `@nestjs/axios` (`HttpModule`)
- Responsable du mapping entre la réponse INSEE (champs `adresse_etablissement`, `code_postal`, `libelle_commune`) et le `SirenSearchResultDto` interne

---

## Audit trail

Chaque mutation écrit dans une seule `prisma.$transaction` :
1. L'entité `Client` créée/modifiée/archivée
2. Un `DomainEvent` correspondant :
   - `ClientCreated`
   - `ClientUpdated`
   - `ClientArchived`

Payload du `DomainEvent` : snapshot des champs modifiés.

---

## DTOs

### `CreateClientDto`

Tous les champs optionnels doivent porter `@IsOptional()` pour que `class-validator` les ignore lorsqu'ils sont absents.

| Champ | Type | Obligatoire | Validation |
|-------|------|-------------|------------|
| `name` | `string` | Oui | `@IsString()` |
| `email` | `string` | Non | `@IsOptional()` `@IsEmail()` |
| `siren` | `string` | Non | `@IsOptional()` `@Matches(/^\d{9}$/)` |
| `siret` | `string` | Non | `@IsOptional()` `@Matches(/^\d{14}$/)` |
| `vatNumber` | `string` | Non | `@IsOptional()` `@IsString()` |
| `billingAddress` | `AddressDto` | Oui | `@ValidateNested()` `@Type(() => AddressDto)` |
| `deliveryAddress` | `AddressDto` | Non | `@IsOptional()` `@ValidateNested()` `@Type(() => AddressDto)` |

Note : `@ValidateNested()` doit toujours être accompagné de `@Type(() => AddressDto)` (de `class-transformer`) pour que la transformation de l'objet plain soit effective avant la validation.

### `UpdateClientDto`

`PartialType(CreateClientDto)` — tous les champs deviennent optionnels.

### `SirenSearchResultDto`

Utilise un type d'adresse simplifié (différent d'`AddressDto`) pour correspondre à la structure de l'API INSEE sans transformation lossy.

| Champ | Type | Description |
|-------|------|-------------|
| `siren` | `string` | SIREN 9 chiffres |
| `name` | `string` | Dénomination sociale |
| `address` | `SireneAddressDto` | Adresse du siège (format INSEE) |

**`SireneAddressDto`** :

| Champ | Type | Description |
|-------|------|-------------|
| `street` | `string` | Numéro et voie |
| `city` | `string` | Libellé commune |
| `zip` | `string` | Code postal (pas de validation stricte) |
| `country` | `string` | Pays (libellé, pas ISO code) |

---

## Tests unitaires

### `ClientService`

| Cas | Description |
|-----|-------------|
| `create` — ok | Client créé, DomainEvent `ClientCreated` écrit |
| `create` — SIREN dupliqué dans l'org | Erreur 409 |
| `findAll` | Liste filtrée sur `organizationId` + `deletedAt: null` |
| `findOne` — ok | Client retourné |
| `findOne` — not found | Erreur 404 |
| `findOne` — autre organisation | Erreur 404 (pas d'accès cross-organisation) |
| `update` — ok | Client modifié, DomainEvent `ClientUpdated` écrit |
| `update` — not found | Erreur 404 |
| `update` — autre organisation | Erreur 404 |
| `remove` — ok | `deletedAt` rempli, DomainEvent `ClientArchived` écrit |
| `remove` — not found | Erreur 404 |
| `remove` — autre organisation | Erreur 404 |

Note : `remove` sur un client avec des factures en cours (DRAFT, SENT, DEPOSITED) est **hors scope Sprint 2** — le soft delete est appliqué sans blocage. Cette vérification sera ajoutée en Sprint 4 lorsque le cycle de vie des factures sera complet.

### `SireneService`

| Cas | Description |
|-----|-------------|
| Recherche ok | Retourne liste de `SirenSearchResult` mappés |
| API timeout | Propagation erreur 502 |
| Résultat vide | Retourne tableau vide |

---

## Hors scope (Sprint 2)

- Cache des résultats Sirene
- Pagination de la liste clients (peu de clients pour un micro-entrepreneur)
- Import CSV de clients
- Dédoublonnage automatique par SIREN
- Blocage de l'archivage si le client a des factures en cours (Sprint 4)
