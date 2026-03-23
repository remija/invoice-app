# Invoice App - CLAUDE.md

## Project
French e-invoicing SaaS for micro-entrepreneurs. Monorepo with 3 apps.

## Stack
- **API**: NestJS + Prisma + PostgreSQL
- **App**: React 18 (Vite) + Tailwind + React Router
- **Marketing**: Next.js (App Router) + Tailwind
- **Monorepo**: Turborepo with npm workspaces
- **Auth**: AWS Cognito
- **Tests**: Jest (backend unit) + Playwright (E2E)

## Commands
```bash
# Dev
docker compose up -d          # PostgreSQL + ElasticMQ
npm run dev                   # All apps via Turborepo

# API only
cd apps/api
npm run dev                   # NestJS watch mode
npm test                      # Jest unit tests
npm run db:generate           # Prisma client
npm run db:push               # Push schema to DB
npm run db:migrate            # Create migration

# Frontend
cd apps/app && npm run dev    # Vite dev server :5173
cd apps/marketing && npm run dev  # Next.js :3001
```

## Architecture
- **Plain services**: Each domain module has a service, controller, DTOs, and module file.
- **Atomic audit trail**: Every mutation writes entity + DomainEvent in a single `prisma.$transaction`.
- **DomainEvent table**: Append-only audit log (legal requirement for e-invoicing).
- **No CQRS/EventBus**: Removed as premature. Will add SQS processors when async work is needed (Sprint 3+).

## Patterns
- Service methods: validate -> $transaction(persist entity + audit event) -> return.
- DTOs use `class-validator` decorators with `!` assertion for required fields.
- Tests: mock Prisma (including $transaction) and test service logic in isolation.
- Shared types in `packages/shared/`.

## Key files
- `apps/api/prisma/schema.prisma` - Database schema
- `apps/api/src/app.module.ts` - Root NestJS module
- `apps/api/src/common/events/domain-event.entity.ts` - Event data type
- `apps/api/src/organization/` - Reference module (service pattern)

## Documentation
- `docs/PLAN.md` - Roadmap, sprints, architecture, grille tarifaire
- `docs/SPECS.md` - Specifications fonctionnelles, exigences legales, etat de l'implementation

## Conventions
- Language: code in English, UI text in French
- SIREN: 9 digits, SIRET: 14 digits
- Invoice numbers: sequential, format "YYYY-NNN"
- All monetary values use Decimal (Prisma) / number (TS)
