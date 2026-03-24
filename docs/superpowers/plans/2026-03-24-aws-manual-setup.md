# AWS Infrastructure & GitHub Setup Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision all AWS resources and GitHub secrets so that `git push` to `main` triggers a working deployment of API (ECS Fargate Spot), App (S3 + CloudFront), and Marketing (S3 + CloudFront).

**Architecture:** ECS Fargate Spot behind ALB for the NestJS API. Two S3+CloudFront distributions for the static frontends. RDS PostgreSQL in private subnet. Cognito for auth. OIDC federation for GitHub Actions. All infra created manually via AWS console.

**Tech Stack:** AWS Console (eu-west-3 default, us-east-1 for CloudFront certs), GitHub Settings UI.

**Spec:** `docs/superpowers/specs/2026-03-23-aws-deployment-design.md`

**Pre-condition:** All code changes are done and merged to `main` (Dockerfile, health endpoint, CORS, GitHub Actions workflows). Nothing to code — this plan is 100% infrastructure and configuration.

---

## Reference Values

Use these exact names throughout to stay consistent with the GitHub Actions workflows.

| Resource | Name / Value |
|---|---|
| Default region | `eu-west-3` |
| VPC CIDR | `10.0.0.0/16` |
| Public subnet A | `10.0.1.0/24` — eu-west-3a |
| Public subnet B | `10.0.2.0/24` — eu-west-3b |
| Private subnet A | `10.0.3.0/24` — eu-west-3a |
| Private subnet B | `10.0.4.0/24` — eu-west-3b |
| ECR repository | `invoice-api` |
| ECS cluster | `invoice-cluster` |
| ECS service | `invoice-api-service` |
| ECS task def | `invoice-api` |
| ECS container | `invoice-api` |
| ECS execution role | `ecsTaskExecutionRole-invoice` |
| IAM deploy role | `github-actions-deploy` |
| S3 bucket (app) | `invoice-app-frontend` |
| S3 bucket (marketing) | `invoice-marketing-site` |
| SSM prefix | `/invoice-api/` |
| API subdomain | `invoice-api.remi-jacquart.dev` |
| App subdomain | `invoice-app.remi-jacquart.dev` |
| Marketing subdomain | `invoice-marketing.remi-jacquart.dev` |

> **Before starting:** Go to AWS console top-right → your account name → note your **Account ID** (12 digits). You will need it in Tasks 9 and 10.

---

## Task Order Overview

```
Task 1  → ACM Certificates (start first — DNS validation takes time)
Task 2  → VPC & Networking
Task 3  → Security Groups
Task 4  → Cognito User Pool + App Client
Task 5  → SSM Parameter Store — Cognito values
Task 6  → RDS PostgreSQL
Task 7  → SSM Parameter Store — DATABASE_URL
Task 8  → ECR Repository (repo seulement, pas de push manuel)
Task 9  → IAM: ECS Task Execution Role
Task 10 → IAM: GitHub Actions OIDC Provider + Deploy Role
Task 11 → ALB (Target Group + Listeners)
Task 12 → ECS Cluster + Task Definition + Service
Task 13 → S3 Buckets
Task 14 → CloudFront Distributions (needs Task 1 certs validated)
Task 15 → DNS Records (app CNAMEs)
Task 16 → GitHub Repository Secrets
Task 17 → First Deployment & Smoke Test
```

---

### Task 1: ACM — Request 3 Certificates

**Start this first.** DNS validation takes 5–30 minutes. You can do other tasks while waiting.

⚠️ CloudFront requires certs in **us-east-1** (global). ALB cert must be in **eu-west-3**.

#### Cert A — us-east-1 (for App CloudFront)

- [ ] **Step 1:** Switch AWS console region to `us-east-1`
- [ ] **Step 2:** Navigate to **Certificate Manager** → **Request certificate** → **Request a public certificate**
- [ ] **Step 3:** Domain: `invoice-app.remi-jacquart.dev`
- [ ] **Step 4:** Validation method: **DNS validation**
- [ ] **Step 5:** Click **Request** → open the certificate → copy the CNAME **Name** and **Value** shown under "Domains"
- [ ] **Step 6:** Add that CNAME record to your DNS provider (this validates ownership):
  ```
  Name:  _<hash>.invoice-app.remi-jacquart.dev
  Type:  CNAME
  Value: _<hash>.acm-validations.aws.
  ```

#### Cert B — us-east-1 (for Marketing CloudFront)

- [ ] **Step 7:** Same region (`us-east-1`) → **Request certificate** again
- [ ] **Step 8:** Domain: `invoice-marketing.remi-jacquart.dev`
- [ ] **Step 9:** DNS validation → **Request** → copy CNAME Name + Value
- [ ] **Step 10:** Add that CNAME to DNS provider

#### Cert C — eu-west-3 (for ALB)

- [ ] **Step 11:** Switch console region to `eu-west-3`
- [ ] **Step 12:** Navigate to **Certificate Manager** → **Request certificate**
- [ ] **Step 13:** Domain: `invoice-api.remi-jacquart.dev`
- [ ] **Step 14:** DNS validation → **Request** → copy CNAME Name + Value
- [ ] **Step 15:** Add that CNAME to DNS provider

> The 3 validation CNAMEs are now live. Continue with the next tasks. Certs will show **"Issued"** status once DNS propagates. Check back before Task 14 (CloudFront needs them validated).

---

### Task 2: VPC & Networking

Region: `eu-west-3`

#### VPC

- [ ] **Step 1:** Navigate to **VPC** → **Your VPCs** → **Create VPC**
  - Name: `invoice-vpc`
  - IPv4 CIDR: `10.0.0.0/16`
  - Tenancy: Default
  - Click **Create VPC**

#### Internet Gateway

- [ ] **Step 2:** **Internet Gateways** → **Create internet gateway**
  - Name: `invoice-igw`
  - Click **Create** → then **Actions** → **Attach to VPC** → select `invoice-vpc`

#### Public Subnets

- [ ] **Step 3:** **Subnets** → **Create subnet**
  - VPC: `invoice-vpc`
  - Add 2 subnets (use **Add new subnet** button):
    1. Name: `invoice-public-a`, AZ: `eu-west-3a`, CIDR: `10.0.1.0/24`
    2. Name: `invoice-public-b`, AZ: `eu-west-3b`, CIDR: `10.0.2.0/24`
  - Click **Create subnets**

#### Private Subnets

- [ ] **Step 4:** **Create subnet** again
  - VPC: `invoice-vpc`
  - Add 2 subnets:
    1. Name: `invoice-private-a`, AZ: `eu-west-3a`, CIDR: `10.0.3.0/24`
    2. Name: `invoice-private-b`, AZ: `eu-west-3b`, CIDR: `10.0.4.0/24`
  - Click **Create subnets**

#### Public Route Table

- [ ] **Step 5:** **Route Tables** → **Create route table**
  - Name: `invoice-public-rt`
  - VPC: `invoice-vpc`
  - Click **Create**
- [ ] **Step 6:** Select `invoice-public-rt` → **Routes** tab → **Edit routes** → **Add route**
  - Destination: `0.0.0.0/0`
  - Target: **Internet Gateway** → `invoice-igw`
  - Click **Save changes**
- [ ] **Step 7:** **Subnet associations** tab → **Edit subnet associations**
  - Select both public subnets (`invoice-public-a`, `invoice-public-b`)
  - Click **Save associations**

**Verify:** VPC dashboard should show 1 VPC, 4 subnets, 1 IGW attached.

---

### Task 3: Security Groups

Region: `eu-west-3` — navigate to **VPC** → **Security Groups**

#### ALB Security Group

- [ ] **Step 1:** **Create security group**
  - Name: `invoice-alb-sg`
  - Description: `ALB inbound HTTP and HTTPS`
  - VPC: `invoice-vpc`
  - Inbound rules:
    - Type: HTTPS, Port: 443, Source: `0.0.0.0/0`
    - Type: HTTP, Port: 80, Source: `0.0.0.0/0`
  - Outbound rules: leave default (all traffic)
  - Click **Create security group**
  - **Note the security group ID** (e.g. `sg-0abc123...`) — needed for ECS SG

#### ECS Security Group

- [ ] **Step 2:** **Create security group**
  - Name: `invoice-ecs-sg`
  - Description: `ECS tasks — inbound from ALB only`
  - VPC: `invoice-vpc`
  - Inbound rules:
    - Type: Custom TCP, Port: 3000, Source: **Custom** → paste the `invoice-alb-sg` ID
  - Outbound rules: leave default (all traffic — ECS needs to reach ECR, SSM, RDS)
  - Click **Create security group**
  - **Note the security group ID** — needed for RDS SG

#### RDS Security Group

- [ ] **Step 3:** **Create security group**
  - Name: `invoice-rds-sg`
  - Description: `RDS PostgreSQL — inbound from ECS only`
  - VPC: `invoice-vpc`
  - Inbound rules:
    - Type: PostgreSQL, Port: 5432, Source: **Custom** → paste the `invoice-ecs-sg` ID
  - Outbound rules: leave default
  - Click **Create security group**

---

### Task 4: Cognito User Pool + App Client

Region: `eu-west-3` — navigate to **Cognito**

> **Pourquoi pas de client secret ?** Le React SPA appelle Cognito directement depuis le navigateur. Un client secret dans un bundle JS est accessible à n'importe qui via les DevTools — il ne faut donc jamais en générer pour un SPA. L'API NestJS, elle, vérifie les JWT via JWKS (clés publiques) et n'a pas besoin du secret.

#### Créer le User Pool (sans app client dans le wizard)

- [ ] **Step 1:** **Create user pool**
- [ ] **Step 2:** Sign-in options: select **Email** only → **Next**
- [ ] **Step 3:** Password policy: keep Cognito defaults → **Next**
- [ ] **Step 4:** MFA: select **No MFA** → **Next**
- [ ] **Step 5:** Email delivery: select **Send email with Cognito** (free sandbox) → **Next**
- [ ] **Step 6:** User pool name: `invoice-users`
  - Dans la section "Initial app client" :
    - App type : sélectionner **Single-page application** ← ⚠️ clé du problème
    - (Ce choix désactive automatiquement la génération du client secret)
    - App client name : `invoice-app-client`
  - **Next** → **Create user pool**

> **Si l'assistant Cognito ne propose pas le choix SPA ou génère quand même un secret :** ne pas utiliser ce client. Passer à l'étape suivante pour en créer un manuellement.

#### Si le client créé par le wizard a un secret — créer un nouveau client

- [ ] **Step 7 (si nécessaire):** Dans le user pool créé → onglet **App clients** → **Create app client**
  - App type : **Public client**
  - App client name : `invoice-app-client-spa`
  - **Décocher** "Generate client secret" si la case est cochée
  - Auth flows : laisser les defaults (ALLOW_USER_SRP_AUTH, ALLOW_REFRESH_TOKEN_AUTH)
  - Click **Create app client**
  - Ignorer (ou supprimer) l'ancien client qui avait un secret

#### Noter les valeurs

- [ ] **Step 8:** Dans le user pool → noter :
  - **User pool ID** (format : `eu-west-3_XXXXXXXXX`)
  - Onglet **App clients** → ouvrir `invoice-app-client` (ou `invoice-app-client-spa`) → noter le **Client ID** (longue chaîne hexadécimale)
  - Vérifier que la ligne **"Client secret"** est absente ou vide — si elle est présente, recommencer avec Step 7.

---

### Task 5: SSM Parameter Store — Cognito Values

Region: `eu-west-3` — navigate to **Systems Manager** → **Parameter Store**

- [ ] **Step 1:** **Create parameter**
  - Name: `/invoice-api/COGNITO_USER_POOL_ID`
  - Tier: Standard
  - Type: **SecureString**
  - KMS key: leave default (`alias/aws/ssm`)
  - Value: paste the User Pool ID from Task 4
  - Click **Create parameter**

- [ ] **Step 2:** **Create parameter**
  - Name: `/invoice-api/COGNITO_CLIENT_ID`
  - Tier: Standard
  - Type: **SecureString**
  - Value: paste the Client ID from Task 4
  - Click **Create parameter**

---

### Task 6: RDS PostgreSQL

Region: `eu-west-3` — navigate to **RDS**

#### DB Subnet Group

- [ ] **Step 1:** **Subnet groups** → **Create DB subnet group**
  - Name: `invoice-db-subnet-group`
  - Description: `Private subnets for RDS`
  - VPC: `invoice-vpc`
  - AZs: `eu-west-3a`, `eu-west-3b`
  - Subnets: select both private subnets (`invoice-private-a`, `invoice-private-b`)
  - Click **Create**

#### RDS Instance

- [ ] **Step 2:** **Databases** → **Create database**
  - Creation method: **Standard create**
  - Engine: **PostgreSQL**
  - Version: PostgreSQL **16** (latest 16.x)
  - Template: **Free tier**
  - DB instance identifier: `invoice-db`
  - Master username: `invoice`
  - Credentials management: **Self managed** → set a strong password (save it securely)
- [ ] **Step 3:** Instance config: `db.t3.micro`
- [ ] **Step 4:** Storage: 20 GiB gp2, disable autoscaling
- [ ] **Step 5:** Connectivity:
  - VPC: `invoice-vpc`
  - DB subnet group: `invoice-db-subnet-group`
  - Public access: **No**
  - Security group: remove default, add `invoice-rds-sg`
  - AZ: `eu-west-3a`
- [ ] **Step 6:** Additional configuration:
  - Initial database name: `invoice_db`
  - Automated backups: enabled, 7 days retention
  - Leave everything else default
- [ ] **Step 7:** Click **Create database** → wait 5–10 min for status **Available**
- [ ] **Step 8:** Open the created instance → note the **Endpoint** (e.g. `invoice-db.xxxx.eu-west-3.rds.amazonaws.com`)

---

### Task 7: SSM Parameter Store — DATABASE_URL

Region: `eu-west-3` — navigate to **Systems Manager** → **Parameter Store**

- [ ] **Step 1:** Build the connection string using values from Task 6:
  ```
  postgresql://invoice:<PASSWORD>@<RDS_ENDPOINT>:5432/invoice_db
  ```
  Example: `postgresql://invoice:mypassword@invoice-db.abc123.eu-west-3.rds.amazonaws.com:5432/invoice_db`

- [ ] **Step 2:** **Create parameter**
  - Name: `/invoice-api/DATABASE_URL`
  - Tier: Standard
  - Type: **SecureString**
  - Value: paste the full connection string
  - Click **Create parameter**

**Verify:** You should now have 3 parameters under `/invoice-api/`:
- `/invoice-api/COGNITO_USER_POOL_ID`
- `/invoice-api/COGNITO_CLIENT_ID`
- `/invoice-api/DATABASE_URL`

---

### Task 8: ECR Repository

Region: `eu-west-3` — navigate to **ECR**

> Pas besoin de push manuel. Le service ECS sera créé avec `desired count: 0` (Task 12), donc ECS ne tentera pas de puller l'image avant le premier déploiement GitHub Actions (Task 17).

- [ ] **Step 1:** **Repositories** → **Create repository**
  - Visibility: **Private**
  - Repository name: `invoice-api`
  - Image tag mutability: Mutable
  - Leave all other settings default
  - Click **Create repository**
- [ ] **Step 2:** Note the full URI: `<ACCOUNT_ID>.dkr.ecr.eu-west-3.amazonaws.com/invoice-api`

---

### Task 9: IAM — ECS Task Execution Role

Region: `eu-west-3` — navigate to **IAM** (IAM is global but SSM resources are regional)

This role allows ECS to pull images from ECR, write logs to CloudWatch, and read secrets from SSM.

#### Create the Role

- [ ] **Step 1:** **IAM** → **Roles** → **Create role**
  - Trusted entity: **AWS service**
  - Use case: **Elastic Container Service** → **Elastic Container Service Task**
  - Click **Next**
- [ ] **Step 2:** Add managed policies:
  - Search and select: `AmazonECSTaskExecutionRolePolicy`
  - Click **Next**
- [ ] **Step 3:** Role name: `ecsTaskExecutionRole-invoice`
  - Click **Create role**

#### Add SSM Permissions (Inline Policy)

- [ ] **Step 4:** Open the newly created role → **Add permissions** → **Create inline policy**
- [ ] **Step 5:** Click **JSON** tab, paste:
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "ssm:GetParameters",
          "ssm:GetParameter"
        ],
        "Resource": "arn:aws:ssm:eu-west-3:<ACCOUNT_ID>:parameter/invoice-api/*"
      },
      {
        "Effect": "Allow",
        "Action": "kms:Decrypt",
        "Resource": "arn:aws:kms:eu-west-3:<ACCOUNT_ID>:key/alias/aws/ssm"
      }
    ]
  }
  ```
  Replace `<ACCOUNT_ID>` with your actual 12-digit account ID.
  ⚠️ The `kms:Decrypt` statement is required because the SSM params are **SecureString** (KMS-encrypted). Without it, ECS tasks fail to start with `AccessDeniedException` when fetching secrets.
- [ ] **Step 6:** Policy name: `invoice-api-ssm-read`
  - Click **Create policy**

**Verify:** The role `ecsTaskExecutionRole-invoice` should have 2 permission policies:
- `AmazonECSTaskExecutionRolePolicy` (managed)
- `invoice-api-ssm-read` (inline)

---

### Task 10: IAM — GitHub Actions OIDC Provider + Deploy Role

Region: **IAM is global** — navigate to **IAM**

#### OIDC Identity Provider

- [ ] **Step 1:** **IAM** → **Identity providers** → **Add provider**
  - Provider type: **OpenID Connect**
  - Provider URL: `https://token.actions.githubusercontent.com`
  - Click **Get thumbprint** (AWS fetches it automatically)
  - Audience: `sts.amazonaws.com`
  - Click **Add provider**

#### Deploy Role

- [ ] **Step 2:** **Roles** → **Create role**
  - Trusted entity: **Web identity**
  - Identity provider: `token.actions.githubusercontent.com`
  - Audience: `sts.amazonaws.com`
  - Click **Next**
- [ ] **Step 3:** Skip adding policies for now (we'll add inline policy) → **Next**
- [ ] **Step 4:** Role name: `github-actions-deploy`
  - Click **Create role**

#### Tighten the Trust Policy (scope to your repo)

- [ ] **Step 5:** Open `github-actions-deploy` role → **Trust relationships** tab → **Edit trust policy**
- [ ] **Step 6:** Replace with the following (replace `<ACCOUNT_ID>` and `<GITHUB_USERNAME>`):
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
        },
        "Action": "sts:AssumeRoleWithWebIdentity",
        "Condition": {
          "StringEquals": {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
          },
          "StringLike": {
            "token.actions.githubusercontent.com:sub": "repo:<GITHUB_USERNAME>/invoice-app:ref:refs/heads/main"
          }
        }
      }
    ]
  }
  ```
  - Click **Update policy**

#### Deploy Role Permissions (Inline Policy)

- [ ] **Step 7:** **Permissions** tab → **Add permissions** → **Create inline policy** → **JSON**:
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "ECRAuth",
        "Effect": "Allow",
        "Action": "ecr:GetAuthorizationToken",
        "Resource": "*"
      },
      {
        "Sid": "ECRPush",
        "Effect": "Allow",
        "Action": [
          "ecr:BatchCheckLayerAvailability",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ],
        "Resource": "arn:aws:ecr:eu-west-3:<ACCOUNT_ID>:repository/invoice-api"
      },
      {
        "Sid": "ECSDescribe",
        "Effect": "Allow",
        "Action": [
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition"
        ],
        "Resource": "*"
      },
      {
        "Sid": "ECSUpdate",
        "Effect": "Allow",
        "Action": [
          "ecs:UpdateService",
          "ecs:DescribeServices"
        ],
        "Resource": "arn:aws:ecs:eu-west-3:<ACCOUNT_ID>:service/invoice-cluster/invoice-api-service"
      },
      {
        "Sid": "S3Objects",
        "Effect": "Allow",
        "Action": [
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetObject"
        ],
        "Resource": [
          "arn:aws:s3:::invoice-app-frontend/*",
          "arn:aws:s3:::invoice-marketing-site/*"
        ]
      },
      {
        "Sid": "S3List",
        "Effect": "Allow",
        "Action": "s3:ListBucket",
        "Resource": [
          "arn:aws:s3:::invoice-app-frontend",
          "arn:aws:s3:::invoice-marketing-site"
        ]
      },
      {
        "Sid": "CloudFrontInvalidate",
        "Effect": "Allow",
        "Action": "cloudfront:CreateInvalidation",
        "Resource": "*"
      },
      {
        "Sid": "PassExecutionRole",
        "Effect": "Allow",
        "Action": "iam:PassRole",
        "Resource": "arn:aws:iam::<ACCOUNT_ID>:role/ecsTaskExecutionRole-invoice"
      }
    ]
  }
  ```
  Replace `<ACCOUNT_ID>` throughout.
- [ ] **Step 8:** Policy name: `github-actions-deploy-policy`
  - Click **Create policy**

- [ ] **Step 9:** Note the role ARN: `arn:aws:iam::<ACCOUNT_ID>:role/github-actions-deploy` (shown at the top of the role page). Save this — needed in Task 16.

---

### Task 11: ALB (Application Load Balancer)

Region: `eu-west-3` — navigate to **EC2** → **Load Balancers**

#### Target Group (create before ALB)

- [ ] **Step 1:** **EC2** → **Target Groups** → **Create target group**
  - Target type: **IP addresses**
  - Target group name: `invoice-api-tg`
  - Protocol: HTTP, Port: 3000
  - VPC: `invoice-vpc`
  - Health checks:
    - Protocol: HTTP
    - Path: `/health`
    - Healthy threshold: 2
    - Unhealthy threshold: 3
    - Timeout: 5s
    - Interval: 30s
  - Click **Next** → **Create target group** (no IPs to register yet — ECS registers them automatically)

#### Load Balancer

- [ ] **Step 2:** **Load Balancers** → **Create load balancer** → **Application Load Balancer**
  - Name: `invoice-alb`
  - Scheme: **Internet-facing**
  - IP address type: IPv4
  - VPC: `invoice-vpc`
  - Mappings: select `eu-west-3a` (public-a) and `eu-west-3b` (public-b) subnets
  - Security groups: remove default, add `invoice-alb-sg`
- [ ] **Step 3:** Listeners:
  - **HTTP:80** — Action: Redirect to HTTPS, status 301
  - **HTTPS:443** — Action: Forward to `invoice-api-tg`
    - SSL certificate: select the `invoice-api.remi-jacquart.dev` cert from **eu-west-3** (Task 1, Cert C)
  - Click **Create load balancer**
- [ ] **Step 4:** Note the **DNS name** of the ALB (e.g. `invoice-alb-xxxx.eu-west-3.elb.amazonaws.com`) — needed in Task 15.

---

### Task 12: ECS Cluster + Task Definition + Service

Region: `eu-west-3` — navigate to **ECS**

#### Cluster

- [ ] **Step 1:** **Clusters** → **Create cluster**
  - Cluster name: `invoice-cluster`
  - Infrastructure: **AWS Fargate** only (uncheck EC2)
  - Click **Create**

#### Task Definition

- [ ] **Step 2:** **Task definitions** → **Create new task definition**
  - Task definition family: `invoice-api`
  - Launch type: **Fargate**
  - Task role: none (leave empty — the task itself doesn't call AWS APIs)
  - Task execution role: `ecsTaskExecutionRole-invoice`
  - CPU: 0.25 vCPU
  - Memory: 0.5 GB
  - Network mode: awsvpc (default for Fargate)

- [ ] **Step 3:** **Container** section — Add container:
  - Container name: `invoice-api`
  - Image URI: `<ACCOUNT_ID>.dkr.ecr.eu-west-3.amazonaws.com/invoice-api:latest`
  - Port mapping: Container port `3000`, Protocol TCP

- [ ] **Step 4:** **Environment variables** (plain text):
  | Key | Value |
  |---|---|
  | `NODE_ENV` | `production` |
  | `PORT` | `3000` |
  | `CORS_ORIGIN` | `https://invoice-app.remi-jacquart.dev,https://invoice-marketing.remi-jacquart.dev` |

- [ ] **Step 5:** **Secrets from SSM** (under Environment variables, type = "ValueFrom"):
  | Key | Value (SSM ARN) |
  |---|---|
  | `DATABASE_URL` | `arn:aws:ssm:eu-west-3:<ACCOUNT_ID>:parameter/invoice-api/DATABASE_URL` |
  | `COGNITO_USER_POOL_ID` | `arn:aws:ssm:eu-west-3:<ACCOUNT_ID>:parameter/invoice-api/COGNITO_USER_POOL_ID` |
  | `COGNITO_CLIENT_ID` | `arn:aws:ssm:eu-west-3:<ACCOUNT_ID>:parameter/invoice-api/COGNITO_CLIENT_ID` |

- [ ] **Step 6:** **Log collection** → Enable, driver: `awslogs`, auto-configure (creates log group `/ecs/invoice-api`)
- [ ] **Step 7:** Click **Create** → task definition revision 1 should appear

#### Service

- [ ] **Step 8:** Go to `invoice-cluster` → **Services** → **Create**
  - Launch type: **Fargate**
  - Capacity provider strategy: click **Use capacity provider strategy** → **Add capacity provider**
    - Add `FARGATE_SPOT`, weight 1, base 0
    - Remove `FARGATE` if it was auto-added
  - Task definition: `invoice-api` (revision 1)
  - Service name: `invoice-api-service`
  - Desired tasks: **0** ← l'image n'existe pas encore dans ECR ; elle sera pushée par GitHub Actions en Task 17
- [ ] **Step 9:** Networking:
  - VPC: `invoice-vpc`
  - Subnets: select both **public** subnets (ECS runs in public subnet, no NAT Gateway needed)
  - Security group: `invoice-ecs-sg`
  - Public IP: **Enabled** (required for ECR/SSM access without NAT)
- [ ] **Step 10:** Load balancing:
  - Load balancer type: **Application Load Balancer**
  - Load balancer: `invoice-alb`
  - Listener: `443:HTTPS`
  - Target group: `invoice-api-tg`
- [ ] **Step 11:** Click **Create** → le service apparaît avec **0/0 running** — c'est attendu.

**Verify:** Le service `invoice-api-service` existe dans le cluster `invoice-cluster`, statut **Active**, desired count 0. Aucune task ne tente de démarrer.

---

### Task 13: S3 Buckets

Region: `eu-west-3` — navigate to **S3** (S3 is global but buckets are regional)

#### App Bucket

- [ ] **Step 1:** **Create bucket**
  - Bucket name: `invoice-app-frontend`
  - Region: `eu-west-3`
  - Block all public access: **enabled** (leave checked)
  - Versioning: disabled
  - Click **Create bucket**

#### Marketing Bucket

- [ ] **Step 2:** **Create bucket**
  - Bucket name: `invoice-marketing-site`
  - Region: `eu-west-3`
  - Block all public access: **enabled**
  - Click **Create bucket**

> Do NOT add a bucket policy yet — CloudFront OAC policies are added in Task 14.

---

### Task 14: CloudFront Distributions

⚠️ **Check Task 1 first:** Go to **Certificate Manager** → **us-east-1** → confirm both CloudFront certs show status **"Issued"**. If not, wait and check again in a few minutes.

Navigate to **CloudFront** (global service)

#### App Distribution

- [ ] **Step 1:** **Create distribution**
- [ ] **Step 2:** Origin:
  - Origin domain: select `invoice-app-frontend.s3.eu-west-3.amazonaws.com`
  - Origin access: **Origin access control settings (recommended)**
  - Click **Create new OAC** → name: `invoice-app-oac` → **Create**
- [ ] **Step 3:** Default cache behavior:
  - Viewer protocol policy: **Redirect HTTP to HTTPS**
  - Cache policy: **CachingOptimized**
  - Origin request policy: none
- [ ] **Step 4:** Settings:
  - Alternate domain name: `invoice-app.remi-jacquart.dev`
  - SSL certificate: select the `invoice-app.remi-jacquart.dev` cert (from **us-east-1**)
  - Default root object: `index.html`
- [ ] **Step 5:** Click **Create distribution**
- [ ] **Step 6:** A banner appears: **"Copy policy"** → click it to copy the S3 bucket policy JSON
  - Go to **S3** → `invoice-app-frontend` → **Permissions** → **Bucket policy** → **Edit** → paste the JSON → **Save**
- [ ] **Step 7:** Back in CloudFront → **Error pages** tab → **Create custom error response**:
  - HTTP error code: `403`, Response page: `/index.html`, HTTP response code: `200`
  - Add another: HTTP error code: `404`, Response page: `/index.html`, HTTP response code: `200`
  - (These handle React Router client-side navigation — S3 returns 403 for unknown paths)
- [ ] **Step 8:** Note the **Distribution domain name** (e.g. `d1abc.cloudfront.net`) and the **Distribution ID** — save both, needed in Tasks 15 and 16.

#### Marketing Distribution

- [ ] **Step 9:** **Create distribution**
- [ ] **Step 10:** Origin:
  - Origin domain: `invoice-marketing-site.s3.eu-west-3.amazonaws.com`
  - Origin access: **Origin access control settings**
  - Click **Create new OAC** → name: `invoice-marketing-oac` → **Create**
- [ ] **Step 11:** Default cache behavior:
  - Viewer protocol policy: **Redirect HTTP to HTTPS**
  - Cache policy: **CachingOptimized**
- [ ] **Step 12:** Settings:
  - Alternate domain name: `invoice-marketing.remi-jacquart.dev`
  - SSL certificate: `invoice-marketing.remi-jacquart.dev` cert (us-east-1)
  - Default root object: `index.html`
- [ ] **Step 13:** Click **Create distribution** → copy + apply the S3 bucket policy to `invoice-marketing-site`
- [ ] **Step 14:** Back in CloudFront → **Error pages** tab → **Create custom error response**:
  - HTTP error code: `403`, Response page: `/index.html`, HTTP response code: `200`
  - (Next.js static export generates one HTML file per page. S3 returns 403 for paths that don't match an exact object — e.g. trailing-slash URLs like `/about/`. This redirect prevents blank pages.)
- [ ] **Step 15:** Note the **Distribution domain name** and **Distribution ID** — save both.

> Distributions take 5–15 minutes to deploy globally. Continue with DNS records.

---

### Task 15: DNS Records (App CNAMEs)

Add these at your DNS provider (wherever `remi-jacquart.dev` is managed — Cloudflare, OVH, Gandi, etc.).

- [ ] **Step 1:** Add CNAME for API:
  ```
  Name:  invoice-api.remi-jacquart.dev
  Type:  CNAME
  Value: invoice-alb-xxxx.eu-west-3.elb.amazonaws.com  ← ALB DNS from Task 11
  TTL:   300
  ```

- [ ] **Step 2:** Add CNAME for App:
  ```
  Name:  invoice-app.remi-jacquart.dev
  Type:  CNAME
  Value: d1abc.cloudfront.net  ← App CloudFront domain from Task 14
  TTL:   300
  ```

- [ ] **Step 3:** Add CNAME for Marketing:
  ```
  Name:  invoice-marketing.remi-jacquart.dev
  Type:  CNAME
  Value: d2xyz.cloudfront.net  ← Marketing CloudFront domain from Task 14
  TTL:   300
  ```

**Verify DNS propagation:**
```bash
dig invoice-api.remi-jacquart.dev +short
dig invoice-app.remi-jacquart.dev +short
dig invoice-marketing.remi-jacquart.dev +short
```
Expected: each should resolve to the respective AWS endpoint.

---

### Task 16: GitHub Repository Secrets

Navigate to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

- [ ] **Step 1:** Secret: `AWS_DEPLOY_ROLE_ARN`
  - Value: `arn:aws:iam::<ACCOUNT_ID>:role/github-actions-deploy`

- [ ] **Step 2:** Secret: `APP_CLOUDFRONT_DISTRIBUTION_ID`
  - Value: CloudFront Distribution ID for the App (from Task 14 Step 8, format: `EXXXXXXXXX`)

- [ ] **Step 3:** Secret: `MARKETING_CLOUDFRONT_DISTRIBUTION_ID`
  - Value: CloudFront Distribution ID for Marketing (from Task 14 Step 14)

- [ ] **Step 4:** Secret: `VITE_COGNITO_USER_POOL_ID`
  - Value: Cognito User Pool ID (from Task 4, format: `eu-west-3_XXXXXXXXX`)

- [ ] **Step 5:** Secret: `VITE_COGNITO_CLIENT_ID`
  - Value: Cognito App Client ID (from Task 4, long hex string)

**Verify:** Repository secrets page should show 5 secrets with no values visible.

---

### Task 17: First Deployment & Smoke Test

Toute l'infrastructure est en place. Déclencher les 3 workflows GitHub Actions.

#### Trigger Deployments

- [ ] **Step 1:** Aller sur le repo GitHub → onglet **Actions**
- [ ] **Step 2:** Lancer **Deploy API** en premier (il doit push l'image avant que l'API puisse démarrer) :
  - Cliquer **Deploy API** → **Run workflow** → **Run workflow**
  - Attendre le succès (coche verte) — le workflow build + push l'image dans ECR et met à jour la task definition
- [ ] **Step 3:** Passer le service ECS à `desired count: 1` :
  - **ECS** → `invoice-cluster` → **Services** → `invoice-api-service` → **Update**
  - Desired tasks : **1** → **Update**
  - Attendre ~2 min que la task atteigne le statut **Running** et que la target group la marque **healthy**
- [ ] **Step 4:** Lancer **Deploy Marketing** :
  - Cliquer **Deploy Marketing** → **Run workflow** → **Run workflow**
  - Attendre le succès
- [ ] **Step 5:** Lancer **Deploy App** :
  - Cliquer **Deploy App** → **Run workflow** → **Run workflow**
  - Attendre le succès

#### Smoke Tests

- [ ] **Step 6:** Test the API health endpoint:
  ```bash
  curl https://invoice-api.remi-jacquart.dev/health
  ```
  Expected: `{"status":"ok"}`

- [ ] **Step 7:** Test the marketing site:
  Open `https://invoice-marketing.remi-jacquart.dev` in a browser.
  Expected: Landing page loads with HTTPS, no mixed content warnings.

- [ ] **Step 8:** Test the React app:
  Open `https://invoice-app.remi-jacquart.dev` in a browser.
  Expected: "Facture.dev" dashboard loads.

- [ ] **Step 9:** Test SPA routing (React Router):
  Navigate to `https://invoice-app.remi-jacquart.dev/nonexistent-route`
  Expected: React app loads (not a 404 error) — confirms the CloudFront custom error response is working.

- [ ] **Step 10:** Verify HTTPS redirect:
  ```bash
  curl -I http://invoice-api.remi-jacquart.dev/health
  ```
  Expected: `301 Moved Permanently` redirecting to HTTPS.

---

## Summary

| Task | Resource | Time estimate |
|------|----------|--------------|
| 1 | ACM Certificates (3) | 5 min setup + wait for DNS |
| 2 | VPC, subnets, IGW, route table | 10 min |
| 3 | 3 Security Groups | 5 min |
| 4 | Cognito User Pool + App Client | 5 min |
| 5 | SSM — Cognito params | 3 min |
| 6 | RDS PostgreSQL | 10 min setup + 10 min wait |
| 7 | SSM — DATABASE_URL | 2 min |
| 8 | ECR repository | 2 min |
| 9 | IAM ECS Task Execution Role | 5 min |
| 10 | IAM OIDC + GitHub deploy role | 10 min |
| 11 | ALB + target group | 10 min |
| 12 | ECS cluster + task def + service | 15 min |
| 13 | S3 buckets | 3 min |
| 14 | CloudFront distributions | 10 min setup + 15 min deploy |
| 15 | DNS records | 5 min |
| 16 | GitHub secrets | 5 min |
| 17 | Smoke tests | 5 min |
| **Total** | | **~2h (with waits)** |

**Total AWS monthly cost:** ~4–6 EUR (ECS Fargate Spot ~1.50 €, ALB ~2 €, Route 53 ~0.50 €, everything else free tier).
