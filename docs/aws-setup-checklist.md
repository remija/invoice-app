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
