# ===========================================
# DietAI Production Dockerfile
# Multi-stage build: Bun (deps/build) + Node.js (runtime)
# ===========================================

# Stage 1: Install dependencies
FROM oven/bun:1-alpine AS deps
WORKDIR /app

# Install dependencies needed for Prisma
RUN apk add --no-cache libc6-compat openssl

# Copy dependency files
COPY package.json bun.lock ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN bun install --frozen-lockfile

# ===========================================
# Stage 2: Build the application
# ===========================================
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat openssl

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (use local version from node_modules)
RUN ./node_modules/.bin/prisma generate

# Set environment for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# NEXT_PUBLIC_ variables must be available at build time
# These get embedded into the client-side JavaScript bundle
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

# Build the application
RUN bun run build

# ===========================================
# Stage 3: Production runner
# ===========================================
FROM node:22-alpine AS runner
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Set correct permissions for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy ws module (required by @supabase/realtime-js, not always traced by Next.js)
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/ws ./node_modules/ws

# Copy Prisma schema for runtime migrations
COPY --from=builder /app/prisma ./prisma

# Copy generated Prisma client from custom output location
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma

# Install Prisma CLI globally for migrations (ensures WASM files are correct)
RUN npm install -g prisma@6.9.0

# Copy entrypoint script
COPY --chmod=755 scripts/docker-entrypoint.sh ./docker-entrypoint.sh

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Use entrypoint for migrations, then start server
ENTRYPOINT ["./docker-entrypoint.sh"]
