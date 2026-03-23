# Stage 1: Install dependencies and build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json tsconfig.base.json ./
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

CMD ["node", "apps/api/dist/src/main.js"]
