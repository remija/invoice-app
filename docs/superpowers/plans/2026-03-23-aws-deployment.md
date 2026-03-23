# AWS Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy API (ECS Fargate Spot), App (S3+CloudFront), and Marketing (S3+CloudFront) on AWS with GitHub Actions CI/CD.

**Architecture:** ECS Fargate Spot behind ALB for the NestJS API, two S3+CloudFront distributions for the static frontends (React SPA and Next.js static export). RDS PostgreSQL in private subnet. Cognito for auth. OIDC federation for GitHub Actions deploy. All infra created manually via AWS console.

**Tech Stack:** Docker, ECS Fargate, ALB, S3, CloudFront, RDS PostgreSQL, Cognito, ACM, SSM Parameter Store, GitHub Actions, OIDC

**Spec:** `docs/superpowers/specs/2026-03-23-aws-deployment-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/api/Dockerfile` | Multi-stage Docker build for NestJS |
| Create | `.dockerignore` | Exclude unnecessary files from Docker build context (must be at repo root) |
| Create | `apps/api/src/health/health.controller.ts` | `GET /health` endpoint for ALB health checks |
| Create | `apps/api/src/health/health.module.ts` | NestJS module for health controller |
| Modify | `apps/api/src/app.module.ts` | Import HealthModule |
| Modify | `apps/api/src/main.ts` | Configure CORS for production domain |
| Modify | `apps/app/src/lib/api.ts` | Use `VITE_API_URL` env var for API base |
| Modify | `apps/marketing/next.config.js` | Add `output: 'export'` |
| Create | `.github/workflows/deploy-api.yml` | API deployment to ECS |
| Create | `.github/workflows/deploy-app.yml` | React app deployment to S3+CloudFront |
| Create | `.github/workflows/deploy-marketing.yml` | Marketing site deployment to S3+CloudFront |

---

### Task 1: Health Check Endpoint

Add a `GET /health` endpoint for the ALB to probe. No auth required, returns 200 with `{ "status": "ok" }`.

**Files:**
- Create: `apps/api/src/health/health.controller.ts`
- Create: `apps/api/src/health/health.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/health/health.controller.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/health/health.controller.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { HealthController } from '../../src/health/health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get(HealthController);
  });

  it('should return status ok', () => {
    expect(controller.check()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest test/health/health.controller.spec.ts --no-cache`
Expected: FAIL — cannot find module `../../src/health/health.controller`

- [ ] **Step 3: Write the health controller and module**

Create `apps/api/src/health/health.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
```

Create `apps/api/src/health/health.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

- [ ] **Step 4: Register HealthModule in AppModule**

Modify `apps/api/src/app.module.ts` — add `HealthModule` to the imports array:

```typescript
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    OrganizationModule,
    HealthModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && npx jest test/health/health.controller.spec.ts --no-cache`
Expected: PASS

- [ ] **Step 6: Run all tests to verify no regression**

Run: `cd apps/api && npm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/health/ apps/api/test/health/ apps/api/src/app.module.ts
git commit -m "feat(api): add health check endpoint for ALB"
```

---

### Task 2: Configure CORS for Multiple Origins

The existing `main.ts` already reads `CORS_ORIGIN` but passes it as a single string. Update it to support a comma-separated list so we can allow both frontend origins in production.

**Files:**
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Update CORS to support comma-separated origins**

Modify `apps/api/src/main.ts` — replace the existing `enableCors` call:

```typescript
app.enableCors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : 'http://localhost:5173',
});
```

This allows setting `CORS_ORIGIN=https://invoice-app.remi-jacquart.dev,https://invoice-marketing.remi-jacquart.dev` in the ECS task definition.

- [ ] **Step 2: Verify the API starts locally**

Run: `cd apps/api && npx nest build`
Expected: Builds without errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/main.ts
git commit -m "feat(api): support multiple CORS origins via env var"
```

---

### Task 3: Dockerfile for the API

Create a multi-stage Dockerfile that builds NestJS and produces a minimal production image.

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `.dockerignore` (at repo root — Docker uses `.dockerignore` from the build context, not the Dockerfile directory)

- [ ] **Step 1: Create .dockerignore at repo root**

Create `.dockerignore` (repo root, since the build context is `.`):

```
node_modules
dist
.env
.env.*
*.md
test
coverage
.git
```

- [ ] **Step 2: Create multi-stage Dockerfile**

Create `apps/api/Dockerfile`:

```dockerfile
# Stage 1: Install dependencies and build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies (including dev for build)
RUN npm ci --workspace=apps/api --workspace=packages/shared --include-workspace-root

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build shared package and API
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/api

# Stage 2: Production image
FROM node:22-alpine AS runner

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN npm ci --workspace=apps/api --workspace=packages/shared --include-workspace-root --omit=dev

# Copy Prisma schema and generate client for production
COPY apps/api/prisma ./apps/api/prisma
RUN cd apps/api && npx prisma generate

# Copy built files
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "apps/api/dist/main.js"]
```

- [ ] **Step 3: Test Docker build locally**

Run: `docker build -f apps/api/Dockerfile -t invoice-api:test .`
Expected: Image builds successfully

- [ ] **Step 4: Test Docker run locally (smoke test)**

Run: `docker run --rm -e DATABASE_URL="postgresql://invoice:invoice_dev@host.docker.internal:5432/invoice_db" -e COGNITO_USER_POOL_ID=test -e COGNITO_CLIENT_ID=test -p 3000:3000 invoice-api:test`

In another terminal: `curl http://localhost:3000/health`
Expected: `{"status":"ok"}`

Stop the container with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add apps/api/Dockerfile .dockerignore
git commit -m "feat(api): add Dockerfile for ECS deployment"
```

---

### Task 4: Configure React App API URL from Environment

Update the React API client to use `VITE_API_URL` so it can target the production API.

**Files:**
- Modify: `apps/app/src/lib/api.ts`

- [ ] **Step 1: Update API base URL**

Modify `apps/app/src/lib/api.ts` — replace the first line:

```typescript
const API_BASE = import.meta.env.VITE_API_URL || '/api';
```

In development, `VITE_API_URL` is not set so it falls back to `/api` (proxied by Vite). In production, it's set to `https://invoice-api.remi-jacquart.dev` at build time.

- [ ] **Step 2: Verify dev server still works**

Run: `cd apps/app && npx vite build`
Expected: Builds without errors

- [ ] **Step 3: Commit**

```bash
git add apps/app/src/lib/api.ts
git commit -m "feat(app): use VITE_API_URL env var for API base URL"
```

---

### Task 5: Configure Next.js Static Export

Enable static export so the marketing site can be hosted on S3.

**Files:**
- Modify: `apps/marketing/next.config.js`

- [ ] **Step 1: Add output: 'export'**

Replace `apps/marketing/next.config.js` with:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
};

module.exports = nextConfig;
```

- [ ] **Step 2: Verify static export works**

Run: `cd apps/marketing && npx next build`
Expected: Build succeeds and produces an `out/` directory with HTML files

- [ ] **Step 3: Verify the output directory exists**

Run: `ls apps/marketing/out/index.html`
Expected: File exists

- [ ] **Step 4: Commit**

```bash
git add apps/marketing/next.config.js
git commit -m "feat(marketing): enable static export for S3 hosting"
```

---

### Task 6: GitHub Actions — Deploy API

Create the workflow that builds, pushes to ECR, and deploys to ECS.

**Files:**
- Create: `.github/workflows/deploy-api.yml`

- [ ] **Step 1: Create the deploy workflow**

Create `.github/workflows/deploy-api.yml`:

```yaml
name: Deploy API

on:
  workflow_dispatch:
  push:
    branches: [main]
    paths:
      - 'apps/api/**'
      - 'packages/shared/**'

permissions:
  id-token: write
  contents: read

env:
  AWS_REGION: eu-west-3
  ECR_REPOSITORY: invoice-api
  ECS_CLUSTER: invoice-cluster
  ECS_SERVICE: invoice-api-service
  CONTAINER_NAME: invoice-api

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: ecr-login
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push image to ECR
        id: build-image
        env:
          ECR_REGISTRY: ${{ steps.ecr-login.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -f apps/api/Dockerfile -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG -t $ECR_REGISTRY/$ECR_REPOSITORY:latest .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

      - name: Download current task definition
        run: |
          aws ecs describe-task-definition --task-definition invoice-api --query taskDefinition > task-definition.json

      - name: Update task definition with new image
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: task-definition.json
          container-name: ${{ env.CONTAINER_NAME }}
          image: ${{ steps.build-image.outputs.image }}

      - name: Deploy to Amazon ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: ${{ env.ECS_SERVICE }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-api.yml'))"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-api.yml
git commit -m "ci: add API deployment workflow (ECR + ECS Fargate)"
```

---

### Task 7: GitHub Actions — Deploy App (React)

Create the workflow that builds the React SPA and syncs to S3.

**Files:**
- Create: `.github/workflows/deploy-app.yml`

- [ ] **Step 1: Create the deploy workflow**

Create `.github/workflows/deploy-app.yml`:

```yaml
name: Deploy App

on:
  workflow_dispatch:
  push:
    branches: [main]
    paths:
      - 'apps/app/**'
      - 'packages/shared/**'

permissions:
  id-token: write
  contents: read

env:
  AWS_REGION: eu-west-3
  S3_BUCKET: invoice-app-frontend
  CLOUDFRONT_DISTRIBUTION_ID: ${{ secrets.APP_CLOUDFRONT_DISTRIBUTION_ID }}

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Build app
        env:
          VITE_API_URL: https://invoice-api.remi-jacquart.dev
          VITE_COGNITO_USER_POOL_ID: ${{ secrets.VITE_COGNITO_USER_POOL_ID }}
          VITE_COGNITO_CLIENT_ID: ${{ secrets.VITE_COGNITO_CLIENT_ID }}
        run: npx turbo build --filter=app

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Sync to S3
        run: aws s3 sync apps/app/dist/ s3://${{ env.S3_BUCKET }} --delete

      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ env.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-app.yml'))"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-app.yml
git commit -m "ci: add React app deployment workflow (S3 + CloudFront)"
```

---

### Task 8: GitHub Actions — Deploy Marketing

Create the workflow that builds the Next.js static site and syncs to S3.

**Files:**
- Create: `.github/workflows/deploy-marketing.yml`

- [ ] **Step 1: Create the deploy workflow**

Create `.github/workflows/deploy-marketing.yml`:

```yaml
name: Deploy Marketing

on:
  workflow_dispatch:
  push:
    branches: [main]
    paths:
      - 'apps/marketing/**'

permissions:
  id-token: write
  contents: read

env:
  AWS_REGION: eu-west-3
  S3_BUCKET: invoice-marketing-site
  CLOUDFRONT_DISTRIBUTION_ID: ${{ secrets.MARKETING_CLOUDFRONT_DISTRIBUTION_ID }}

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Build marketing site
        run: npx turbo build --filter=marketing

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Sync to S3
        run: aws s3 sync apps/marketing/out/ s3://${{ env.S3_BUCKET }} --delete

      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ env.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-marketing.yml'))"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-marketing.yml
git commit -m "ci: add marketing site deployment workflow (S3 + CloudFront)"
```

---

### Task 9: Manual AWS Setup Checklist

This is not a code task — it's a checklist to follow in the AWS console before the first deployment. Save as a reference document.

**Files:**
- Create: `docs/aws-setup-checklist.md`

- [ ] **Step 1: Write the checklist**

Create `docs/aws-setup-checklist.md`:

```markdown
# AWS Manual Setup Checklist

Complete these steps in the AWS Console before triggering the first deployment.
Region: `eu-west-3` (Paris) unless noted otherwise.

## 1. VPC & Networking
- [ ] Create VPC (e.g. `invoice-vpc`, CIDR `10.0.0.0/16`)
- [ ] Create 2 public subnets in different AZs (e.g. `10.0.1.0/24`, `10.0.2.0/24`)
- [ ] Create 2 private subnets in different AZs (e.g. `10.0.3.0/24`, `10.0.4.0/24`)
- [ ] Create Internet Gateway, attach to VPC
- [ ] Create public route table: `0.0.0.0/0` → Internet Gateway, associate public subnets

## 2. Security Groups
- [ ] ALB SG: inbound TCP 443 from `0.0.0.0/0`, inbound TCP 80 from `0.0.0.0/0` (redirect to 443)
- [ ] ECS SG: inbound TCP 3000 from ALB SG only
- [ ] RDS SG: inbound TCP 5432 from ECS SG only

## 3. RDS PostgreSQL
- [ ] Create DB subnet group with the 2 private subnets
- [ ] Create RDS instance: PostgreSQL 16, db.t3.micro, 20GB gp2
- [ ] Database name: `invoice_db`, master user: `invoice`
- [ ] Attach RDS SG, place in DB subnet group
- [ ] Disable public access
- [ ] Store `DATABASE_URL` in SSM Parameter Store as SecureString:
      `postgresql://invoice:<password>@<rds-endpoint>:5432/invoice_db`

## 4. Cognito
- [ ] Create User Pool: email sign-in, email verification
- [ ] Create App Client (no secret, SRP auth flow)
- [ ] Note `User Pool ID` and `Client ID`
- [ ] Store in SSM Parameter Store: `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`

## 5. ECR
- [ ] Create repository: `invoice-api`

## 6. ACM Certificates
- [ ] **us-east-1**: Request cert for `invoice-app.remi-jacquart.dev` (for CloudFront)
- [ ] **us-east-1**: Request cert for `invoice-marketing.remi-jacquart.dev` (for CloudFront)
- [ ] **eu-west-3**: Request cert for `invoice-api.remi-jacquart.dev` (for ALB)
- [ ] Validate all 3 via DNS (add CNAME records to your DNS provider)

## 7. ALB
- [ ] Create Application Load Balancer in public subnets, attach ALB SG
- [ ] Create target group: type IP, port 3000, protocol HTTP, health check `GET /health`
- [ ] Add HTTPS listener (443) with ACM cert, forward to target group
- [ ] Add HTTP listener (80) redirect to HTTPS

## 8. ECS
- [ ] Create ECS cluster: `invoice-cluster` (Fargate only)
- [ ] Create task definition: `invoice-api`
  - Fargate, 0.25 vCPU, 0.5 GB
  - Container: `invoice-api`, image `<account>.dkr.ecr.eu-west-3.amazonaws.com/invoice-api:latest`
  - Port mapping: 3000
  - Environment: `NODE_ENV=production`, `CORS_ORIGIN=https://invoice-app.remi-jacquart.dev,https://invoice-marketing.remi-jacquart.dev`
  - Secrets from SSM: `DATABASE_URL`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`
- [ ] Create service: `invoice-api-service`
  - Capacity provider: FARGATE_SPOT
  - Desired count: 1
  - Public subnets, assign public IP: enabled
  - Attach ECS SG
  - Attach to ALB target group

## 9. S3 Buckets
- [ ] Create `invoice-app-frontend` bucket (Block all public access)
- [ ] Create `invoice-marketing-site` bucket (Block all public access)

## 10. CloudFront
- [ ] Distribution for App:
  - Origin: S3 `invoice-app-frontend` with OAC
  - Alternate domain: `invoice-app.remi-jacquart.dev`
  - ACM cert from us-east-1
  - Default root object: `index.html`
  - Custom error response: 403 → `/index.html` (200), 404 → `/index.html` (200)
- [ ] Distribution for Marketing:
  - Origin: S3 `invoice-marketing-site` with OAC
  - Alternate domain: `invoice-marketing.remi-jacquart.dev`
  - ACM cert from us-east-1
  - Default root object: `index.html`
- [ ] Update S3 bucket policies to allow OAC access

## 11. IAM (GitHub Actions OIDC)
- [ ] Create OIDC Identity Provider: `token.actions.githubusercontent.com`
  - Audience: `sts.amazonaws.com`
- [ ] Create IAM Role: `github-actions-deploy`
  - Trust policy: allow assume from OIDC provider, condition on repo
  - Permissions:
    - `ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:PutImage`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`, `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer`
    - `ecs:DescribeTaskDefinition`, `ecs:RegisterTaskDefinition`, `ecs:UpdateService`, `ecs:DescribeServices`
    - `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` (on both S3 buckets)
    - `cloudfront:CreateInvalidation`
    - `iam:PassRole` (on ECS task execution role)
    - `ssm:GetParameters` (for ECS to read secrets)

## 12. DNS Records
Add these CNAME records at your DNS provider (wherever remi-jacquart.dev is managed):
- [ ] `invoice-api.remi-jacquart.dev` → ALB DNS name
- [ ] `invoice-app.remi-jacquart.dev` → CloudFront distribution domain
- [ ] `invoice-marketing.remi-jacquart.dev` → CloudFront distribution domain

## 13. GitHub Repository Secrets
- [ ] `AWS_DEPLOY_ROLE_ARN` — ARN of the github-actions-deploy role
- [ ] `APP_CLOUDFRONT_DISTRIBUTION_ID` — CloudFront distribution ID for the React app
- [ ] `MARKETING_CLOUDFRONT_DISTRIBUTION_ID` — CloudFront distribution ID for the marketing site
- [ ] `VITE_COGNITO_USER_POOL_ID` — Cognito User Pool ID
- [ ] `VITE_COGNITO_CLIENT_ID` — Cognito App Client ID
```

- [ ] **Step 2: Commit**

```bash
git add docs/aws-setup-checklist.md
git commit -m "docs: add AWS manual setup checklist"
```

---

## Summary

| Task | Description | Estimated Effort |
|------|-------------|-----------------|
| 1 | Health check endpoint | 5 min |
| 2 | CORS configuration | 2 min |
| 3 | Dockerfile | 10 min |
| 4 | React API URL env var | 2 min |
| 5 | Next.js static export | 2 min |
| 6 | Deploy API workflow | 5 min |
| 7 | Deploy App workflow | 5 min |
| 8 | Deploy Marketing workflow | 5 min |
| 9 | AWS setup checklist | 5 min |

Tasks 1-5 are code changes. Tasks 6-8 are GitHub Actions workflows. Task 9 is documentation for manual AWS console setup. All code tasks should pass CI before moving to workflow tasks.
