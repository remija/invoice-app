# Plan de Developpement - Facture.dev

> Application de facturation electronique pour micro-entrepreneurs francais.
> Derniere mise a jour : 2026-03-23

---

## 1. Vision produit

**Positionnement** : "La facturation electronique sans prise de tete pour auto-entrepreneurs"

- Zero jargon comptable
- 3 clics pour creer une facture conforme
- Automatisation (relances, e-reporting, conformite)
- Pas de lock-in bancaire (vs Tiime)
- Prix transparent : 0 / 9 / 19 EUR HT/mois

**Modele business** : Operateur de Dematerialisation (OD) connecte a une Plateforme Agreee (PA) partenaire (Iopole ou B2Brouter) via API.

---

## 2. Stack technique

```
Monorepo Turborepo (npm workspaces)
├── apps/api          NestJS + Prisma + PostgreSQL (CQRS-lite)
├── apps/app          React 18 (Vite) + Tailwind + React Router
├── apps/marketing    Next.js (App Router) + Tailwind
└── packages/shared   Types TypeScript partages
```

| Composant   | Technologie                          |
| ----------- | ------------------------------------ |
| Backend     | NestJS + @nestjs/cqrs + Prisma       |
| Base        | PostgreSQL (RDS eu-west-3)           |
| Queue       | AWS SQS (ElasticMQ en local)         |
| Auth        | AWS Cognito                          |
| Paiement    | Stripe (abonnements + webhooks)      |
| Email       | AWS SES                              |
| Storage     | AWS S3 + S3 Glacier (archivage)      |
| CDN         | AWS CloudFront                       |
| CI/CD       | GitHub Actions                       |
| Monitoring  | CloudWatch + Sentry                  |
| Region      | eu-west-3 (Paris) -- conformite RGPD |

---

## 3. Architecture

**Principes** :
- Monolithe modulaire (pas de microservices)
- Services NestJS simples (pas de CQRS -- supprime car premature)
- Table `DomainEvent` append-only pour l'audit trail reglementaire
- Chaque mutation ecrit l'entite + l'event d'audit dans une seule `$transaction` Prisma
- SQS sera ajoute au Sprint 3 quand les traitements async seront necessaires

**Flux type (creation facture)** :
```
Controller -> InvoiceService.create(userId, dto)
  1. Valide les donnees (mentions obligatoires, SIREN, etc.)
  2. prisma.$transaction:
     a. Persiste l'Invoice en DB
     b. Persiste DomainEvent (audit trail)
  3. Return invoice
```

**Flux envoi (Sprint 3+, avec SQS)** :
```
Controller -> InvoiceService.send(userId, invoiceId)
  1. $transaction: DRAFT -> SENT + DomainEvent
  2. SQS -> PaSubmissionProcessor (soumet a la PA)
  3. SQS -> EmailProcessor (envoie au client)
  4. Webhook PA -> InvoiceDeposited/Accepted/Refused
```

---

## 4. Modele de donnees

Voir `apps/api/prisma/schema.prisma` pour le schema complet.

**Tables principales** :
- `Organization` : entreprise utilisatrice (SIREN, SIRET, adresse, tier)
- `Client` : clients de l'entreprise (SIREN obligatoire si B2B 2026)
- `Invoice` : factures avec cycle de vie complet
- `LineItem` : lignes de facture
- `DomainEvent` : journal d'audit immutable (append-only)

**Enums** : InvoiceType, Direction, OperationCategory, InvoiceFormat, InvoiceStatus

---

## 5. Grille tarifaire

| Plan        | Prix            | Limite           |
| ----------- | --------------- | ---------------- |
| Decouverte  | Gratuit         | 3 factures/mois  |
| Solo        | 9 EUR HT/mois   | Illimite         |
| Pro         | 19 EUR HT/mois  | Illimite + extras |

**Strategie** : le plan gratuit cree l'entonnoir via l'obligation de reception (sept 2026), puis conversion en payant quand l'emission devient obligatoire (sept 2027).

---

## 6. Roadmap par sprints

### Sprint 1 : Fondations -- TERMINE

- [x] Init monorepo Turborepo (React Vite + NestJS + Next.js)
- [x] Docker Compose (PostgreSQL + ElasticMQ)
- [x] Prisma schema complet (Organization, Client, Invoice, LineItem, DomainEvent)
- [x] Audit trail atomique : entity + DomainEvent dans une seule $transaction
- [x] Auth via Cognito (guard + decorator @CurrentUser + tests)
- [x] CRUD Organization via service simple (create/findByUser/update)
- [x] 12 tests unitaires Jest (service + auth guard)
- [x] Landing page SEO (Next.js) avec capture email + pricing
- [x] CI GitHub Actions (lint + tests + build)
- [x] Package shared (types + DTOs)
- [x] API client React (fetch wrapper avec auth)

Note : CQRS (`@nestjs/cqrs`) et SQS ont ete retires lors d'une revue
code car prematures a ce stade. Seront reintroduits au besoin (Sprint 3+).

### Sprint 2 : Coeur facturation CQRS -- A FAIRE

- [ ] `CreateInvoiceCommand` + Handler (validation mentions, numerotation, calcul TVA)
- [ ] `SendInvoiceCommand` + Handler (changement statut, emission event)
- [ ] `MarkInvoicePaidCommand` + Handler
- [ ] Queries : `GetInvoiceQuery`, `ListInvoicesQuery` avec filtres/pagination
- [ ] CRUD Client avec lookup SIREN (API Sirene INSEE)
- [ ] Les 4 nouveaux champs 2026 comme champs obligatoires
- [ ] Tests unitaires : tous les handlers de facture (couverture > 80%)
- [ ] Tests Playwright : setup + premier E2E (creation facture)

### Sprint 3 : Moteur de formats -- A FAIRE

- [ ] Integration `@e-invoice-eu/core` pour generation EN16931
- [ ] Generateur Factur-X (PDF/A-3 + XML embarque)
- [ ] Generateur UBL
- [ ] Generateur CII
- [ ] Validation schematrons EN16931
- [ ] SQS processor : `PdfGenerationProcessor`
- [ ] Tests unitaires format-engine

### Sprint 4 : Connexion PA + Cycle de vie -- A FAIRE

- [ ] Interface `PaConnector` (abstraction multi-PA)
- [ ] Adapter Iopole (ou B2Brouter)
- [ ] `SubmitToPA` via SQS processor
- [ ] Webhook reception statuts PA
- [ ] Cycle de vie complet (DRAFT -> SENT -> DEPOSITED -> ACCEPTED -> PAID)
- [ ] Reception factures entrantes
- [ ] Tests E2E cycle de vie

### Sprint 5 : Monetisation + Lancement -- A FAIRE

- [ ] Integration Stripe (abonnements, webhooks)
- [ ] Gating par tier (gratuit 3 factures/solo/pro)
- [ ] Email processor (envoi factures + relances via SES)
- [ ] Dashboard minimal
- [ ] Deploy AWS (EC2/ECS + RDS + S3 + CloudFront + SQS)
- [ ] Infra-as-code (CDK ou Terraform)
- [ ] **LANCEMENT** offre gratuite reception

### Sprint 6+ : Post-lancement -- A FAIRE

- [ ] Devis -> facture
- [ ] Relances automatiques
- [ ] E-reporting (B2C + international)
- [ ] OCR import factures fournisseurs
- [ ] Factures recurrentes
- [ ] Export comptable (FEC)

---

## 7. Calendrier cible

| Phase | Periode               | Objectif                           |
| ----- | --------------------- | ---------------------------------- |
| MVP   | Mars - Juillet 2026   | Sprints 1-5                        |
| V1    | Aout 2026             | Lancement offre reception gratuite |
| V2    | Oct 2026 - Aout 2027  | Emission, conversion freemium      |
| V3    | Sept 2027+            | Rush conformite, offre Pro         |

---

## 8. Risques

| Risque                         | Prob.  | Impact | Mitigation                                     |
| ------------------------------ | ------ | ------ | ---------------------------------------------- |
| Tiime gratuit ecrase le marche | Haute  | Fort   | Pas de lock-in bancaire, UX superieure         |
| PA partenaire hausse tarifs    | Moyenne| Fort   | Abstraction multi-PA, contrat negocie          |
| SEO difficile (concurrence)    | Moyenne| Fort   | Longue traine, contenu niche micro-entrepreneur|
| Manque de temps (side project) | Haute  | Moyen  | Scope minimal, pragmatisme                     |
