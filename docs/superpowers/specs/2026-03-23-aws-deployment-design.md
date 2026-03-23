# AWS Deployment Design

## Overview

Deploy all three apps (API, App, Marketing) on AWS with a focus on minimal cost (~4-6 EUR/month) and scalability. Infrastructure is created manually via the AWS console. Code deployment is automated via GitHub Actions (one workflow per app).

## Subdomains

- `invoice-api.remi-jacquart.dev` — NestJS API
- `invoice-app.remi-jacquart.dev` — React SPA
- `invoice-marketing.remi-jacquart.dev` — Next.js static site

A dedicated domain will replace `remi-jacquart.dev` later.

## Architecture

```
           invoice-app.remi-jacquart.dev    invoice-marketing.remi-jacquart.dev
                      │                                │
                      ▼                                ▼
               ┌─────────────┐                  ┌─────────────┐
               │ CloudFront  │                  │ CloudFront  │
               └──────┬──────┘                  └──────┬──────┘
                      ▼                                ▼
               ┌─────────────┐                  ┌─────────────┐
               │  S3 Bucket  │                  │  S3 Bucket  │
               │  (React)    │                  │  (Next.js)  │
               └─────────────┘                  └─────────────┘

                    invoice-api.remi-jacquart.dev
                                │
                                ▼
                       ┌────────────────┐
                       │  ALB (public)  │
                       └───────┬────────┘
                               ▼
                       ┌────────────────┐
                       │  ECS Fargate   │
                       │  Spot Service  │
                       │  (NestJS API)  │
                       │  subnet public │
                       └───────┬────────┘
                               ▼
                       ┌────────────────┐
                       │ RDS PostgreSQL │
                       │  db.t3.micro   │
                       │ subnet private │
                       └────────────────┘

                       ┌────────────────┐
                       │ Cognito User   │
                       │    Pool        │
                       └────────────────┘
```

## Components

### 1. API — ECS Fargate Spot

**Container:**
- Multi-stage `Dockerfile` in `apps/api/` (build NestJS, prod image on Alpine, ~50MB)
- Image stored in ECR (free tier: 500MB storage)
- Tagged with commit SHA

**ECS Configuration:**
- 1 service, 1 task
- 0.25 vCPU / 0.5 GB RAM
- Fargate Spot capacity provider (~70% cheaper than standard, ~1.5 EUR/month)
- If Spot is interrupted, ECS automatically restarts a new task (a few seconds of downtime, acceptable)
- Runs in public subnet (no NAT Gateway cost), secured via security groups

**Networking:**
- ALB in front of ECS, public-facing
- HTTPS via ACM certificate on `invoice-api.remi-jacquart.dev`
- Health check endpoint: `GET /health` (no global prefix in NestJS app)
- Security group: ALB allows inbound 443, ECS allows inbound only from ALB SG

**Environment variables:**
- Injected via ECS Task Definition
- `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `NODE_ENV`
- `DATABASE_URL` stored as a SecureString in SSM Parameter Store (contains the password), injected as a secret in the task definition
- Other secrets also in SSM Parameter Store (free)

### 2. App (React) — S3 + CloudFront

**Build:**
- `vite build` produces `dist/` with static HTML/JS/CSS
- `VITE_API_URL=https://invoice-api.remi-jacquart.dev` injected at build time

**Hosting:**
- S3 bucket (private, no website hosting), accessed by CloudFront via Origin Access Control (OAC)
- CloudFront distribution on `invoice-app.remi-jacquart.dev`
- HTTPS via ACM certificate
- Custom error response: 404 → `/index.html` with 200 status (SPA routing for React Router)

### 3. Marketing (Next.js) — S3 + CloudFront

**Static export:**
- Add `output: 'export'` to `next.config.js`
- `next build` produces `out/` with pure static HTML/CSS/JS
- Possible because the landing page uses no server features (no API routes, no dynamic SSR, no ISR)

**Hosting:**
- Same pattern as React app: S3 private + CloudFront via OAC
- Distribution on `invoice-marketing.remi-jacquart.dev`
- HTTPS via ACM certificate

### 4. Database — RDS PostgreSQL

- **Instance:** db.t3.micro (free tier: 750h/month, 20GB storage, first year)
- **Subnet:** Private, accessible only from ECS security group
- **Multi-AZ:** No (unnecessary for side project, and paid)
- **Backups:** Automatic, 7-day retention (free)
- **Password:** Stored in SSM Parameter Store

### 5. Auth — Cognito

- 1 User Pool in `eu-west-3`
- Free up to 50,000 MAU
- Email as identifier, email confirmation via SES (sandbox mode is sufficient initially)
- `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID` injected into API (task def) and App (build-time env var)

### 6. DNS and HTTPS

- **Route 53:** Hosted zone for `remi-jacquart.dev` subdomain delegation, or CNAME records if DNS is managed elsewhere
- **ACM:** 3 free certificates (one per subdomain), DNS validation
- **Cost:** Route 53 hosted zone = 0.50 EUR/month (skip if DNS managed externally with CNAME records)

## GitHub Actions

### Authentication

OIDC federation between GitHub Actions and AWS (no long-lived AWS access keys):
- IAM OIDC Identity Provider for `token.actions.githubusercontent.com`
- 1 IAM Role with trust policy scoped to the repo
- Permissions: ECR push, ECS deploy, S3 sync, CloudFront invalidation

### Workflow: `deploy-api.yml`

**Trigger:** Push to `main` when `apps/api/**` changes.

**Steps:**
1. Checkout code
2. Configure AWS credentials (OIDC)
3. Login to ECR
4. Build Docker image (tag: commit SHA)
5. Push image to ECR
6. Render new ECS task definition with new image
7. Deploy ECS service (`aws ecs update-service --force-new-deployment`)
8. Wait for service stability

### Workflow: `deploy-app.yml`

**Trigger:** Push to `main` when `apps/app/**` or `packages/shared/**` changes.

**Steps:**
1. Checkout code
2. Configure AWS credentials (OIDC)
3. `npm ci` + `npx turbo build --filter=app` with `VITE_API_URL` env var
4. `aws s3 sync apps/app/dist/ s3://<bucket> --delete`
5. `aws cloudfront create-invalidation --paths "/*"`

### Workflow: `deploy-marketing.yml`

**Trigger:** Push to `main` when `apps/marketing/**` changes.

**Steps:**
1. Checkout code
2. Configure AWS credentials (OIDC)
3. `npm ci` + `npx turbo build --filter=marketing`
4. `aws s3 sync apps/marketing/out/ s3://<bucket> --delete`
5. `aws cloudfront create-invalidation --paths "/*"`

### GitHub Secrets

| Secret | Usage |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | OIDC assume role |
| `VITE_COGNITO_USER_POOL_ID` | React app build |
| `VITE_COGNITO_CLIENT_ID` | React app build |

## Code Changes Required

1. **`apps/api/Dockerfile`** — Multi-stage Docker build for NestJS
2. **`apps/api/src/health/health.controller.ts`** — `GET /health` endpoint for ALB health checks
3. **`apps/marketing/next.config.js`** — Add `output: 'export'` for static generation
4. **`apps/app/src/lib/api.ts`** — Use `VITE_API_URL` env var instead of relative paths
5. **`.github/workflows/deploy-api.yml`** — API deployment workflow
6. **`.github/workflows/deploy-app.yml`** — React app deployment workflow
7. **`.github/workflows/deploy-marketing.yml`** — Marketing site deployment workflow

## Manual AWS Setup (Console)

Resources to create manually before first deployment:

1. **VPC:** 1 VPC, 2 public subnets (different AZs for ALB), 2 private subnets (RDS)
2. **Security Groups:** ALB SG (inbound 443), ECS SG (inbound from ALB), RDS SG (inbound 5432 from ECS)
3. **RDS:** PostgreSQL db.t3.micro in private subnets
4. **ECR:** 1 repository for the API image
5. **ECS:** Cluster, task definition, service (Fargate Spot)
6. **ALB:** Application Load Balancer, target group, HTTPS listener
7. **S3:** 2 buckets (app, marketing), private, OAC configured
8. **CloudFront:** 2 distributions with OAC, custom error responses for SPA
9. **ACM:** 3 certificates — **important: CloudFront requires certs in `us-east-1`**, ALB cert must be in `eu-west-3`
10. **Cognito:** User Pool + App Client in eu-west-3
11. **SSM Parameter Store:** `DATABASE_URL` (SecureString), other secrets
12. **IAM:** OIDC provider + deploy role for GitHub Actions
13. **Route 53 / DNS:** CNAME records pointing subdomains to ALB and CloudFront distributions

## Cost Estimate

| Service | Monthly Cost |
|---|---|
| ECS Fargate Spot (0.25 vCPU, 0.5GB) | ~1.50 EUR |
| ALB | ~2.00 EUR |
| RDS db.t3.micro | 0 EUR (free tier) |
| S3 (2 buckets, minimal storage) | ~0 EUR |
| CloudFront (2 distributions, low traffic) | ~0 EUR |
| ECR (< 500MB) | 0 EUR |
| Cognito (< 50k MAU) | 0 EUR |
| ACM certificates | 0 EUR |
| Route 53 hosted zone | 0.50 EUR |
| SSM Parameter Store | 0 EUR |
| **Total** | **~4-6 EUR/month** |

Note: RDS free tier expires after 12 months. After that, db.t3.micro costs ~15 EUR/month. Consider migrating to an external serverless PostgreSQL (Neon, Supabase) at that point if cost remains a priority.
