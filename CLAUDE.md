# Invoice App - CLAUDE.md

## Project
French e-invoicing SaaS for micro-entrepreneurs. Monorepo with 3 apps.

## Stack
- **API**: NestJS + Prisma + PostgreSQL + CQRS (`@nestjs/cqrs`)
- **App**: React 18 (Vite) + Tailwind + React Router
- **Marketing**: Next.js (App Router) + Tailwind
- **Monorepo**: Turborepo with npm workspaces
- **Queue**: AWS SQS (ElasticMQ locally)
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
- **CQRS-lite**: Commands write + emit events, Queries read. No full event sourcing.
- **Event Log**: `DomainEvent` table is append-only audit trail. Every mutation persists an event.
- **SQS processors**: Async side effects (PDF gen, PA submission, email, e-reporting).
- **PA connector**: Abstraction over Plateforme Agreee APIs (Iopole/B2Brouter).

## Patterns
- Each domain module has: `commands/`, `queries/`, `events/`, controller, module.
- Command handlers: validate -> persist -> emit event -> log to DomainEvent.
- Tests: mock Prisma + EventBus, test handler logic in isolation.
- DTOs use `class-validator` decorators.
- Shared types in `packages/shared/`.

## Key files
- `apps/api/prisma/schema.prisma` - Database schema
- `apps/api/src/app.module.ts` - Root NestJS module
- `apps/api/src/common/events/` - Event log infrastructure
- `apps/api/src/common/sqs/` - SQS producer
- `apps/api/src/organization/` - First CQRS module (reference pattern)

## Documentation
- `docs/PLAN.md` - Roadmap, sprints, architecture, grille tarifaire
- `docs/SPECS.md` - Specifications fonctionnelles, exigences legales, etat de l'implementation

## Conventions
- Language: code in English, UI text in French
- SIREN: 9 digits, SIRET: 14 digits
- Invoice numbers: sequential, format "YYYY-NNN"
- All monetary values use Decimal (Prisma) / number (TS)
