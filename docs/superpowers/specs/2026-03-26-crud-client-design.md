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

Ajout du champ `deletedAt` sur le modèle `Client` :

```prisma
model Client {
  // ... champs existants
  deletedAt DateTime?
}
```

Migration nécessaire (`npm run db:migrate`). Toutes les requêtes filtrent sur `deletedAt: null`.

---

## Endpoints

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `POST` | `/clients` | Créer un client | Oui |
| `GET` | `/clients` | Lister les clients (org courante, non archivés) | Oui |
| `GET` | `/clients/:id` | Récupérer un client | Oui |
| `PATCH` | `/clients/:id` | Modifier un client | Oui |
| `DELETE` | `/clients/:id` | Archiver un client (soft delete) | Oui |
| `GET` | `/clients/siren-lookup` | Recherche Sirene INSEE (`?q=nom_ou_siren`) | Oui |

---

## SireneService

- Appelle `https://recherche-entreprises.api.gouv.fr/search?q=...` (API publique, sans clé)
- Retourne un tableau de `SirenSearchResult` : `{ siren, name, address }`
- Timeout : 5 secondes
- En cas d'erreur ou d'indisponibilité : propagation au client (HTTP 502)
- Implémenté via `@nestjs/axios` (`HttpModule`)

---

## Audit trail

Chaque mutation écrit dans une seule `prisma.$transaction` :
1. L'entité `Client` créée/modifiée/archivée
2. Un `DomainEvent` correspondant :
   - `CLIENT_CREATED`
   - `CLIENT_UPDATED`
   - `CLIENT_ARCHIVED`

Payload du `DomainEvent` : snapshot des champs modifiés.

---

## DTOs

### `CreateClientDto`

| Champ | Type | Obligatoire | Validation |
|-------|------|-------------|------------|
| `name` | `string` | Oui | `@IsString()` |
| `email` | `string` | Non | `@IsEmail()` |
| `siren` | `string` | Non | `@Matches(/^\d{9}$/)` |
| `siret` | `string` | Non | `@Matches(/^\d{14}$/)` |
| `vatNumber` | `string` | Non | `@IsString()` |
| `billingAddress` | `AddressDto` | Oui | `@ValidateNested()` |
| `deliveryAddress` | `AddressDto` | Non | `@ValidateNested()` |

### `UpdateClientDto`

Même structure que `CreateClientDto` avec tous les champs optionnels (`PartialType`).

### `SirenSearchResultDto`

| Champ | Type | Description |
|-------|------|-------------|
| `siren` | `string` | SIREN 9 chiffres |
| `name` | `string` | Dénomination sociale |
| `address` | `AddressDto` | Adresse du siège |

---

## Tests unitaires

### `ClientService`

| Cas | Description |
|-----|-------------|
| `create` — ok | Client créé, DomainEvent `CLIENT_CREATED` écrit |
| `create` — SIREN dupliqué | Erreur 409 si le SIREN existe déjà dans l'organisation |
| `findAll` | Liste filtrée sur `organizationId` + `deletedAt: null` |
| `findOne` — ok | Client retourné |
| `findOne` — not found | Erreur 404 |
| `findOne` — autre org | Erreur 404 (pas d'accès cross-organisation) |
| `update` — ok | Client modifié, DomainEvent `CLIENT_UPDATED` écrit |
| `update` — not found | Erreur 404 |
| `remove` — ok | `deletedAt` rempli, DomainEvent `CLIENT_ARCHIVED` écrit |
| `remove` — not found | Erreur 404 |

### `SireneService`

| Cas | Description |
|-----|-------------|
| Recherche ok | Retourne liste de `SirenSearchResult` |
| API timeout | Propagation erreur 502 |
| Résultat vide | Retourne tableau vide |

---

## Hors scope (Sprint 2)

- Cache des résultats Sirene
- Pagination de la liste clients (peu de clients pour un micro-entrepreneur)
- Import CSV de clients
- Dédoublonnage automatique par SIREN
