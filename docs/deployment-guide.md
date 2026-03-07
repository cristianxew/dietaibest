# DietAI — Deployment Guide

> Generated: 2026-03-07 | Version: 1.2.0

## Deployment Options

| Platform | Status | Notes |
|---|---|---|
| **Vercel** | Recommended | Native Next.js support, auto CI/CD from GitHub |
| **Docker** | Available | `Dockerfile` + `docker-compose.yml` present |
| **Self-hosted** | Possible | Requires Node.js/Bun + PostgreSQL |

---

## Production Build

```bash
# Build
bun build

# Start
bun start
```

The app uses Next.js `output: "standalone"` — produces a minimal self-contained build at `.next/standalone/`.

---

## Docker

### Dockerfile

Multi-stage production Dockerfile. Uses `output: "standalone"` for minimal image size.

**Build:**
```bash
docker build -t dietai:latest .
```

**Run:**
```bash
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e NEXTAUTH_URL=https://your-domain.com \
  -e NEXTAUTH_SECRET=secret \
  # ... (all required env vars)
  dietai:latest
```

> **Note:** The `next.config.ts` explicitly includes `ws` module in `outputFileTracingIncludes` to ensure Supabase Realtime works correctly in standalone mode.

### docker-compose.yml

For local development or staging with a local PostgreSQL instance:

```bash
docker-compose up           # Start app + PostgreSQL
docker-compose up -d        # Background
docker-compose down         # Stop
docker-compose down -v      # Stop + remove volumes (⚠️ deletes DB data)
```

---

## Vercel Deployment

1. Connect GitHub repository to Vercel
2. Configure all environment variables in Vercel project settings (see [development-guide.md](./development-guide.md#environment-variables))
3. Deploy — Vercel auto-detects Next.js and configures the build

**Build command**: `bun run build` (or `next build`)
**Output directory**: `.next`

---

## Environment Variables (Production)

All environment variables from the dev setup are required in production. Critical production-specific values:

```bash
NEXTAUTH_URL=https://your-production-domain.com
NEXTAUTH_SECRET=<strong-random-secret>
DATABASE_URL=<supabase-pooled-connection>
DIRECT_URL=<supabase-direct-connection>
```

See full list in [development-guide.md](./development-guide.md#environment-variables).

---

## Database Migrations (Production)

```bash
# Run pending migrations (safe for production)
bun run db:migrate

# Or via Prisma CLI directly
bunx prisma migrate deploy
```

> **Never** use `db:push` in production — it can cause data loss.

---

## Infrastructure Requirements

| Requirement | Minimum | Notes |
|---|---|---|
| Node.js / Bun | 18+ | For standalone server |
| Memory | 512MB+ | Recommended 1GB+ |
| PostgreSQL | 14+ | Via Supabase (managed) |
| External APIs | See env vars | Edamam, USDA, Browser-Use, Google Cloud |

---

## CI/CD

> **No CI/CD pipeline found** — no `.github/workflows/` or equivalent detected.

**Recommended setup:**
- Add GitHub Actions workflow for:
  - `bun run lint` + `bun test` on PR
  - Auto-deploy to Vercel on merge to `main`

---

## Monitoring & Health

**Health check endpoint:** `GET /api/health`

Use this endpoint for load balancer health checks or uptime monitoring.
