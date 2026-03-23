# Specifications - Facture.dev

> Specifications fonctionnelles et reglementaires.
> Derniere mise a jour : 2026-03-23

---

## Table des matieres

1. [Cadre reglementaire](#1-cadre-reglementaire)
2. [Exigences legales et reponse technique](#2-exigences-legales-et-reponse-technique)
3. [Etat de l'implementation](#3-etat-de-limplementation)
4. [Architecture produite](#4-architecture-produite)

---

## 1. Cadre reglementaire

### 1.1 Calendrier d'obligations

| Date             | Obligation                                                  | Cible                          |
| ---------------- | ----------------------------------------------------------- | ------------------------------ |
| **1er sept 2026**| Reception de factures electroniques obligatoire              | Toutes les entreprises         |
| **1er sept 2027**| Emission de factures electroniques obligatoire               | Micro-entreprises, TPE, PME    |
| **1er sept 2027**| E-reporting obligatoire (B2C, international, paiements)     | Micro-entreprises, TPE, PME    |

Sources : [economie.gouv.fr](https://www.economie.gouv.fr/tout-savoir-sur-la-facturation-electronique-pour-les-entreprises), [Cegid](https://www.cegid.com/fr/facturation-electronique/facture-electronique-obligatoire/calendrier-facture-electronique/)

### 1.2 Sanctions applicables

| Infraction                              | Sanction                                        |
| --------------------------------------- | ----------------------------------------------- |
| Facture non electronique                | 50 EUR par facture (plafond 15 000 EUR/an)      |
| Absence de plateforme agreee            | 500 EUR (apres mise en demeure de 3 mois)       |
| Transmission e-reporting manquante      | 500 EUR par transmission (plafond 15 000 EUR/an)|
| Premiere infraction                     | Tolerance si corrigee sous 30 jours             |

Sources : [service-public.fr](https://entreprendre.service-public.gouv.fr/vosdroits/F31808), [urssaf.fr](https://www.urssaf.fr/accueil/actualites/facturation-electronique.html)

### 1.3 Notre role : Operateur de Dematerialisation (OD)

Nous ne sommes **pas** une Plateforme Agreee (PA). Devenir PA exige ~500K-2M EUR d'investissement, un audit de securite, et 12-24 mois de procedure. En tant qu'OD, nous :

- Fournissons l'interface utilisateur de creation/gestion de factures
- Generons les fichiers conformes (Factur-X, UBL, CII)
- Transmettons les factures a une PA partenaire (Iopole ou B2Brouter) via API
- Recevons les statuts et factures entrantes depuis la PA

La PA se charge de : la transmission au PPF/autres PA, la validation, le routage, et la conformite de la transmission elle-meme.

---

## 2. Exigences legales et reponse technique

### 2.1 E-Invoicing : formats obligatoires

| Exigence | Detail | Implementation | Statut |
| -------- | ------ | -------------- | ------ |
| **Factur-X** | PDF/A-3 avec XML CII embarque, profil EN16931 | `apps/api/src/invoice/format/facturx.generator.ts` via `@e-invoice-eu/core` + `pdf-lib` | Sprint 3 |
| **UBL** | XML UBL 2.1, norme EN16931 | `apps/api/src/invoice/format/ubl.generator.ts` via `@e-invoice-eu/core` | Sprint 3 |
| **CII** | XML UN/CEFACT CII, norme EN16931 | `apps/api/src/invoice/format/cii.generator.ts` via `@e-invoice-eu/core` | Sprint 3 |
| **Validation EN16931** | Les factures doivent passer les schematrons de la norme | Validation automatique avant soumission a la PA | Sprint 3 |

### 2.2 Mentions obligatoires sur les factures

#### Mentions existantes (Code de Commerce + CGI)

| Mention | Champ Prisma | Validation | Statut |
| ------- | ------------ | ---------- | ------ |
| Identite vendeur (nom, adresse) | `Organization.name`, `Organization.address` | DTO class-validator, champs requis | Done |
| SIREN/SIRET vendeur | `Organization.siren`, `Organization.siret` | Regex `^\d{9}$` / `^\d{14}$` | Done |
| N° TVA intracommunautaire vendeur | `Organization.vatNumber` | Optionnel (micro-entrepreneurs souvent exoneres) | Done |
| Forme juridique + capital | `Organization.legalForm`, `Organization.capital` | String requis / optionnel | Done |
| Ville RCS | `Organization.rcsCity` | Optionnel | Done |
| Identite acheteur (nom, adresse) | `Client.name`, `Client.billingAddress` | Champs requis dans le schema | Sprint 2 |
| Numero sequentiel de facture | `Invoice.number` | Unique par organisation, format `YYYY-NNN`, sans trous | Sprint 2 |
| Date d'emission | `Invoice.issueDate` | DateTime requis | Sprint 2 |
| Date d'echeance | `Invoice.dueDate` | DateTime requis | Sprint 2 |
| Conditions de paiement | `Invoice.paymentTerms` | String optionnel | Sprint 2 |
| Detail des lignes | `LineItem.description`, `quantity`, `unitPriceHt` | Champs requis, au moins 1 ligne | Sprint 2 |
| Taux et montant TVA par taux | `Invoice.vatDetails` (JSON) | Calcule automatiquement par ligne | Sprint 2 |
| Total HT / Total TTC | `Invoice.totalHt`, `Invoice.totalTtc` | Decimal, calcule automatiquement | Sprint 2 |

#### 4 nouvelles mentions obligatoires 2026

| Mention 2026 | Champ Prisma | Detail | Statut |
| ------------ | ------------ | ------ | ------ |
| **SIREN du client** (si B2B) | `Client.siren` | Obligatoire pour tout client professionnel. Lookup auto via API Sirene INSEE. | Sprint 2 |
| **Adresse de livraison** (si differente) | `Client.deliveryAddress` | JSON optionnel. Obligatoire si differente de l'adresse de facturation. | Done (schema) |
| **Categorie d'operation** | `Invoice.operationCategory` | Enum : `GOODS`, `SERVICES`, `MIXED`. Obligatoire sur chaque facture. | Done (schema) |
| **TVA sur les debits** | `Invoice.vatOnDebits` | Boolean. A indiquer si l'entreprise a opte pour la TVA sur les debits. | Done (schema) |

Sources : [Pennylane](https://www.pennylane.com/fr/fiches-pratiques/facture-electronique/reforme-facturation-electronique), [FNFE-MPE](https://fnfe-mpe.org/ressources/)

### 2.3 Numerotation sequentielle

| Regle | Implementation |
| ----- | -------------- |
| Sequence continue sans trous | `CreateInvoiceHandler` attribue le prochain numero : dernier numero de l'organisation + 1 |
| Pas de reutilisation | Contrainte unique `@@unique([organizationId, number])` dans Prisma |
| Format lisible | `YYYY-NNN` (ex: `2026-001`, `2026-042`) |
| Remise a zero possible par annee | Prefix annee dans le numero |

### 2.4 Immutabilite des factures emises

| Regle | Implementation |
| ----- | -------------- |
| Une facture emise ne peut pas etre modifiee | `SendInvoiceHandler` passe le statut a `SENT`. Apres ca, seuls les changements de statut sont autorises (pas de modification de contenu). |
| Correction par avoir uniquement | Type `CREDIT_NOTE` dans l'enum `InvoiceType`. Une facture d'avoir reference la facture originale. |
| Tracabilite | Chaque changement de statut genere un `DomainEvent` immutable dans la table d'audit. |

### 2.5 Cycle de vie des factures

```
DRAFT  -->  SENT  -->  DEPOSITED  -->  ACCEPTED  -->  PAID
                           |
                           +-------->  REFUSED
```

| Statut    | Signification | Declencheur |
| --------- | ------------- | ----------- |
| DRAFT     | Brouillon, modifiable | Creation par l'utilisateur |
| SENT      | Envoyee, immutable | `SendInvoiceCommand` |
| DEPOSITED | Recue par la PA | Webhook PA |
| RECEIVED  | Recue par le destinataire (factures entrantes) | Webhook PA |
| ACCEPTED  | Acceptee par le destinataire | Webhook PA |
| REFUSED   | Refusee par le destinataire | Webhook PA |
| PAID      | Payee | `MarkInvoicePaidCommand` |

Chaque transition de statut est enregistree comme `DomainEvent` dans la table d'audit.

### 2.6 E-Reporting

| Exigence | Detail | Implementation | Statut |
| -------- | ------ | -------------- | ------ |
| **Donnees de transaction B2C** | Toute vente a un particulier doit etre reportee | Agregation des factures B2C, transmission via PA | Sprint 6 |
| **Donnees de transaction internationales** | Ventes/achats hors France | Idem, filtrage par pays client | Sprint 6 |
| **Donnees de paiement** | Si TVA exigible a l'encaissement | Transmission quand `MarkInvoicePaid` + `vatOnDebits=true` | Sprint 6 |
| Toutes transmissions via PA | Pas de transmission directe au PPF | Via l'API de la PA partenaire | Sprint 4+ |

### 2.7 Archivage et conservation

| Exigence | Duree | Implementation | Statut |
| -------- | ----- | -------------- | ------ |
| Conservation fiscale (LPF L102 B) | 6 ans | AWS S3 (PDFs + XMLs) | Sprint 5 |
| Conservation commerciale (Code de Commerce L123-22) | 10 ans | AWS S3 -> S3 Glacier (lifecycle policy) | Sprint 5 |
| Integrite garantie | - | S3 Object Lock (WORM) + checksums | Sprint 5 |
| Lisibilite garantie | - | PDF/A-3 (format d'archivage longue duree) | Sprint 3 |
| Tracabilite | - | Table `DomainEvent` (audit trail immutable) | Done |

### 2.8 Connexion Plateforme Agreee

| Exigence | Implementation | Statut |
| -------- | -------------- | ------ |
| Emission via PA | `PaConnector` interface + adapter (Iopole/B2Brouter) | Sprint 4 |
| Reception via PA | Webhook endpoint pour factures entrantes | Sprint 4 |
| Abstraction multi-PA | Interface `PaConnector` permet de changer de PA sans modifier le code metier | Sprint 4 |
| Gestion des erreurs | Retry avec backoff exponentiel via SQS | Sprint 4 |

### 2.9 Obligations SaaS / RGPD

| Exigence | Implementation | Statut |
| -------- | -------------- | ------ |
| Hebergement en France | AWS eu-west-3 (Paris) | Prevu (Sprint 5) |
| RGPD : politique de confidentialite | Page sur le site marketing | A faire |
| RGPD : consentement cookies | Banniere cookies sur le marketing | A faire |
| RGPD : DPA sous-traitants | Contrats avec AWS, Stripe, PA | A faire |
| CGV / CGU | Pages legales | A faire |
| Mentions legales site web | Footer du site marketing | A faire |
| Paiements securises | Stripe (pas de donnees bancaires chez nous, pas de PCI-DSS) | Sprint 5 |
| Chiffrement en transit | TLS via CloudFront + ALB | Sprint 5 |
| Chiffrement au repos | S3 SSE + RDS encryption | Sprint 5 |
| Gestion des secrets | AWS Secrets Manager | Sprint 5 |

---

## 3. Etat de l'implementation

### 3.1 Ce qui est fait (Sprint 1)

#### Monorepo et infrastructure

| Element | Fichiers | Description |
| ------- | -------- | ----------- |
| Turborepo | `turbo.json`, `package.json` | Monorepo npm workspaces, orchestration build/dev/test/lint |
| Docker Compose | `docker-compose.yml`, `elasticmq.conf` | PostgreSQL 16 + ElasticMQ (mock SQS local) |
| CI/CD | `.github/workflows/ci.yml` | GitHub Actions : lint, test, build sur chaque PR |
| Types partages | `packages/shared/src/` | Enums et DTOs TypeScript partages entre front et back |

#### Backend NestJS (`apps/api/`)

| Module | Fichiers | Description |
| ------ | -------- | ----------- |
| **Prisma** | `prisma/schema.prisma`, `src/common/prisma/` | Schema complet (6 modeles, 5 enums), service global |
| **Event Log** | `src/common/events/` | `EventLogService` : persist, findByAggregate, findByEventType. Table `DomainEvent` append-only. |
| **SQS** | `src/common/sqs/` | `SqsService` : producteur de messages SQS, configurable par queue |
| **Auth** | `src/auth/` | `CognitoAuthGuard` (JWT Bearer), `@CurrentUser()` decorator |
| **Organization** | `src/organization/` | Module CQRS complet : 2 commands (Create, Update), 1 query (Get), 2 events, 2 DTOs, 1 controller |

Structure CQRS de chaque module :
```
organization/
├── commands/
│   ├── create-organization.command.ts    # Donnees de la commande
│   ├── create-organization.handler.ts    # Logique : valide -> persiste -> event -> audit
│   ├── update-organization.command.ts
│   └── update-organization.handler.ts
├── queries/
│   ├── get-organization.query.ts
│   └── get-organization.handler.ts
├── events/
│   ├── organization-created.event.ts
│   └── organization-updated.event.ts
├── dto/
│   ├── create-organization.dto.ts        # Validation class-validator
│   └── update-organization.dto.ts
├── organization.controller.ts            # REST endpoints
└── organization.module.ts                # Wiring NestJS
```

#### Tests (12 tests, tous passent)

| Fichier | Tests | Ce qui est couvert |
| ------- | ----- | ------------------ |
| `test/organization/create-organization.handler.spec.ts` | 4 | Creation avec tous les champs, emission d'event, persistence audit, rejet SIREN duplique |
| `test/organization/update-organization.handler.spec.ts` | 4 | Mise a jour, persistence audit, not found, verification propriete |
| `test/common/event-log.service.spec.ts` | 4 | Persistence event, recherche par aggregate, recherche par type avec filtre date |

#### Frontend React (`apps/app/`)

| Fichier | Description |
| ------- | ----------- |
| `src/main.tsx` | Point d'entree, React Router |
| `src/pages/Dashboard.tsx` | Page placeholder |
| `src/lib/api.ts` | Client API fetch avec auth Bearer automatique |
| Tailwind + Vite | Configuration complete, proxy API vers port 3000 |

#### Site marketing Next.js (`apps/marketing/`)

| Fichier | Description |
| ------- | ----------- |
| `app/page.tsx` | Landing page complete : hero, features (3 colonnes), pricing (3 plans), urgence (deadlines), footer |
| `app/layout.tsx` | Layout avec SEO metadata (title, description, keywords) |
| Formulaire email | Capture email pour notification au lancement |

### 3.2 Ce qui reste a faire

| Sprint | Contenu | Priorite |
| ------ | ------- | -------- |
| **Sprint 2** | CRUD factures CQRS, CRUD clients, lookup SIREN, validation mentions, numerotation, calcul TVA | Haute |
| **Sprint 3** | Generateurs Factur-X/UBL/CII, validation EN16931, PDF processor | Haute |
| **Sprint 4** | Connexion PA (Iopole), cycle de vie complet, reception factures | Haute |
| **Sprint 5** | Stripe, gating tiers, emails SES, dashboard, deploy AWS | Haute |
| **Sprint 6+** | Devis, relances, e-reporting, OCR, recurrentes, export FEC | Moyenne |

---

## 4. Architecture produite

### 4.1 Arborescence du projet

```
invoice-app/
├── .github/workflows/ci.yml           # CI GitHub Actions
├── .gitignore
├── CLAUDE.md                           # Instructions pour Claude
├── docs/
│   ├── PLAN.md                         # Plan de developpement (ce fichier est a cote)
│   └── SPECS.md                        # Ce fichier
├── docker-compose.yml                  # PostgreSQL + ElasticMQ
├── elasticmq.conf                      # Config queues SQS locales
├── package.json                        # Monorepo root
├── turbo.json                          # Config Turborepo
├── tsconfig.base.json                  # TypeScript shared config
├── apps/
│   ├── api/                            # NestJS backend
│   │   ├── prisma/schema.prisma        # Schema DB complet
│   │   ├── src/
│   │   │   ├── main.ts                 # Bootstrap NestJS
│   │   │   ├── app.module.ts           # Module racine
│   │   │   ├── common/
│   │   │   │   ├── prisma/             # PrismaService (global)
│   │   │   │   ├── events/             # EventLogService (audit)
│   │   │   │   └── sqs/               # SqsService (queue)
│   │   │   ├── auth/                   # CognitoAuthGuard
│   │   │   └── organization/           # Module CQRS complet
│   │   │       ├── commands/
│   │   │       ├── queries/
│   │   │       ├── events/
│   │   │       └── dto/
│   │   └── test/                       # 12 tests unitaires
│   ├── app/                            # React (Vite) frontend
│   │   └── src/
│   └── marketing/                      # Next.js landing page
│       └── app/
└── packages/
    └── shared/                         # Types partages
        └── src/
```

### 4.2 Endpoints API disponibles

| Methode | Route              | Description                        | Auth |
| ------- | ------------------ | ---------------------------------- | ---- |
| POST    | /organizations     | Creer son organisation             | Oui  |
| GET     | /organizations/me  | Recuperer son organisation         | Oui  |
| PATCH   | /organizations/me  | Mettre a jour son organisation     | Oui  |

Documentation Swagger disponible sur `/api/docs` en dev.

### 4.3 Commandes dev

```bash
docker compose up -d                    # Demarrer PostgreSQL + ElasticMQ
cd apps/api && npx prisma generate      # Generer le client Prisma
cd apps/api && npx prisma db push       # Pousser le schema en DB
cd apps/api && npm run dev              # API sur :3000
cd apps/app && npm run dev              # Frontend sur :5173
cd apps/marketing && npm run dev        # Marketing sur :3001
cd apps/api && npm test                 # 12 tests unitaires
```
