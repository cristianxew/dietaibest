# DietAI Deployment Guide

**Platform:** Hostinger VPS with Dokploy
**Last Updated:** 2025-12-23

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Hostinger VPS                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │                   Dokploy                        │    │
│  │  ┌───────────┐  ┌───────────┐  ┌─────────────┐  │    │
│  │  │  Traefik  │  │  Next.js  │  │  PostgreSQL │  │    │
│  │  │  (Proxy)  │→ │   App     │→ │  Database   │  │    │
│  │  │  :80/443  │  │   :3000   │  │   :5432     │  │    │
│  │  └───────────┘  └───────────┘  └─────────────┘  │    │
│  └─────────────────────────────────────────────────┘    │
│                    dokploy-network                       │
└─────────────────────────────────────────────────────────┘

External Services:
- Supabase Auth (authentication only - free tier)
- Edamam API (nutrition analysis)
- Browser-Use Cloud (AI web automation - optional)
- Google Cloud Document AI (OCR - optional)
```

---

## Deployment Files

| File                           | Purpose                           |
| ------------------------------ | --------------------------------- |
| `Dockerfile`                   | Multi-stage build (Bun + Node.js) |
| `docker-compose.yml`           | Orchestrates app + PostgreSQL     |
| `.dockerignore`                | Optimizes build context           |
| `.env.production.example`      | Environment variable template     |
| `scripts/docker-entrypoint.sh` | Runs migrations on startup        |
| `src/app/api/health/route.ts`  | Health check endpoint             |

---

## Dokploy Setup Steps

### 1. Create Project
1. Log into Dokploy dashboard at `http://your-vps-ip:3000`
2. Click **New Project** → Name: "DietAI"

### 2. Create Compose Service
1. Click **Create Service** → Select **Compose**
2. Configure:
   - **Provider**: GitHub
   - **Repository**: Your DietAI repo
   - **Branch**: `main`
   - **Compose Path**: `./docker-compose.yml`

### 3. Configure Environment Variables
Go to **Environment** section and add all variables from `.env.production.example`:

**Required:**
```
POSTGRES_PASSWORD=<strong-password>
DOMAIN=yourdomain.com
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
EDAMAM_APP_ID=<your-app-id>
EDAMAM_APP_KEY=<your-app-key>
```

**Important:** `NEXT_PUBLIC_*` variables are embedded into the JavaScript at **build time**.
If you change these values, you must trigger a **full rebuild** (not just restart) for changes to take effect.

**Optional:**
```
GOOGLE_CLIENT_ID=<for-google-oauth>
GOOGLE_CLIENT_SECRET=<for-google-oauth>
SUPABASE_SERVICE_ROLE_KEY=<for-admin-operations>
BROWSER_USE_API_KEY=<for-ai-web-automation>
GOOGLE_CLOUD_PROJECT_ID=<for-document-ai>
```

### 4. Configure Domain & SSL
1. Go to **Domains** section
2. Add your domain (e.g., `DietAI.com`)
3. Enable **SSL** with Let's Encrypt
4. Point your domain's DNS A record to VPS IP

### 5. Enable Auto Deploy
1. Go to **General** settings
2. Toggle **Auto Deploy** ON
3. Copy the webhook URL
4. Add to GitHub:
   - Repository → Settings → Webhooks → Add webhook
   - Payload URL: `<dokploy-webhook-url>`
   - Content type: `application/json`
   - Events: Just the push event

### 6. Deploy
1. Click **Deploy** button
2. Monitor logs for any issues
3. First deployment builds Docker images (~5-10 min)

---

## Post-Deployment Tasks

### Database Seeding (Optional)
If you need seed data, run via Dokploy terminal:
```bash
docker exec -it DietAI-app npx prisma db seed
```

### Google OAuth Configuration
Update Google Cloud Console:
1. Go to APIs & Services → Credentials
2. Edit your OAuth 2.0 Client
3. Add authorized redirect URI:
   ```
   https://yourdomain.com/api/auth/callback/google
   ```

### Verify Deployment
- [ ] App loads at `https://yourdomain.com`
- [ ] SSL certificate valid (green padlock)
- [ ] Sign in with credentials works
- [ ] Sign in with Google works (if configured)
- [ ] Recipe creation works
- [ ] Meal planning works
- [ ] Health endpoint responds: `https://yourdomain.com/api/health`

---

## CI/CD Pipeline

### How It Works
1. Push code to `main` branch
2. GitHub sends webhook to Dokploy
3. Dokploy pulls latest code
4. Docker builds new image
5. Old container stopped, new one started
6. Traefik routes traffic to new container
7. Zero-downtime deployment complete

### Deployment Logs
View in Dokploy dashboard under **Deployments** tab.

---

## Database Management

### Backup
Dokploy provides backup functionality:
1. Go to project → Database service
2. Click **Backups** tab
3. Configure automatic backups or trigger manual backup

### Manual Backup Command
```bash
docker exec DietAI-db pg_dump -U DietAI DietAI > backup.sql
```

### Restore from Backup
```bash
cat backup.sql | docker exec -i DietAI-db psql -U DietAI DietAI
```

### Run Migrations Manually
```bash
docker exec -it DietAI-app npx prisma db push
```

---

## Troubleshooting

### Container Won't Start
1. Check logs in Dokploy dashboard
2. Verify all required env vars are set
3. Ensure database container is healthy first

### Database Connection Issues
1. Check `POSTGRES_PASSWORD` matches in both services
2. Verify database container is running: `docker ps`
3. Test connection: `docker exec -it DietAI-db psql -U DietAI`

### SSL Certificate Issues
1. Verify domain DNS points to VPS IP
2. Check Traefik logs in Dokploy
3. Wait up to 5 minutes for certificate provisioning

### Build Failures
1. Check Dockerfile syntax
2. Verify `bun.lockb` is committed
3. Check for missing dependencies

---

## Authentication Troubleshooting

Authentication issues are common in production deployments. This section covers the most frequent problems and their solutions.

### NEXT_PUBLIC_ Variables Not Working

**Symptom:** Browser console shows `Missing Supabase environment variables`

**Cause:** `NEXT_PUBLIC_*` variables are embedded into JavaScript at **build time**, not runtime.

**Solution:**
1. Variables must be passed as Docker **build args**, not just runtime environment
2. In `Dockerfile`, add before the build step:
   ```dockerfile
   ARG NEXT_PUBLIC_SUPABASE_URL
   ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
   ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
   ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
   ```
3. In `docker-compose.yml`, add build args:
   ```yaml
   build:
     context: .
     dockerfile: Dockerfile
     args:
       - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
       - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
   ```
4. **Trigger a full rebuild** (restart won't work)

### Supabase Configuration for Production

**Symptom:** Magic links don't work, OAuth redirects fail

**Solution:** Configure Supabase Dashboard → Authentication → URL Configuration:

| Setting           | Value                                              |
| ----------------- | -------------------------------------------------- |
| **Site URL**      | `https://yourdomain.com` (exact match, with https) |
| **Redirect URLs** | `https://yourdomain.com/auth/callback`             |
|                   | `https://yourdomain.com/api/auth/callback/google`  |

**Note:** Email/password login doesn't use redirect URLs - those are for magic links and OAuth only.

### Login Succeeds But Session Not Created

**Symptom:** Server logs show successful authentication, but user is redirected back to sign-in

**Cause:** NextAuth cookie configuration issues

**Solution:**
1. **Don't override cookie settings** - let NextAuth auto-configure based on `NEXTAUTH_URL`
2. Remove any custom `cookies: {}` configuration from NextAuth options
3. NextAuth automatically handles:
   - `__Secure-` cookie prefix in production
   - Correct `sameSite` and `secure` flags
   - Domain settings based on `NEXTAUTH_URL`

### NEXTAUTH_URL Mismatch

**Symptom:** Redirects go to wrong URL, cookies not set

**Requirements for NEXTAUTH_URL:**
- Must include `https://` protocol
- Must exactly match your production domain
- No trailing slash

**Correct:**
```
NEXTAUTH_URL=https://dietaimanager.com
```

**Incorrect:**
```
NEXTAUTH_URL=dietaimanager.com          # Missing https://
NEXTAUTH_URL=https://dietaimanager.com/ # Trailing slash
NEXTAUTH_URL=http://dietaimanager.com   # Wrong protocol
```

### Debugging Authentication Issues

**Step 1: Check Browser Console (F12 → Console)**
- Look for `Missing Supabase environment variables` → NEXT_PUBLIC_ build args issue
- Look for CORS errors → Domain mismatch
- Look for 401 errors → Session/cookie issues

**Step 2: Check Server Logs in Dokploy**
Look for these log patterns:
```
[NextAuth] Credentials authorize started     → Auth handler reached
[NextAuth] Supabase user verified           → Supabase token valid
[NextAuth] User upserted successfully       → Database working
[NextAuth] signIn callback returning true   → Auth completed
```

If logs stop at a certain point, that's where the issue is.

**Step 3: Verify Environment Variables**
```bash
# In Dokploy terminal or container shell
echo $NEXTAUTH_URL
echo $NEXTAUTH_SECRET
echo $NEXT_PUBLIC_SUPABASE_URL
```

### Authentication Environment Checklist

| Variable                        | Build Time | Runtime    | Notes                                   |
| ------------------------------- | ---------- | ---------- | --------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | ✓ Required | ✓          | Must pass as build arg                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ Required | ✓          | Must pass as build arg                  |
| `NEXTAUTH_URL`                  |            | ✓ Required | Exact domain with https                 |
| `NEXTAUTH_SECRET`               |            | ✓ Required | Generate with `openssl rand -base64 32` |
| `SUPABASE_SERVICE_ROLE_KEY`     |            | Optional   | For admin operations                    |

---

## Scaling (Future)

### Horizontal Scaling
Enable Docker Swarm mode in Dokploy for multiple app instances.

### Database Optimization
Add PgBouncer for connection pooling if needed.

### CDN
Consider adding Cloudflare for:
- Global CDN caching
- DDoS protection
- Additional SSL layer

---

## Security Checklist

- [ ] Strong `POSTGRES_PASSWORD` (32+ chars)
- [ ] Unique `NEXTAUTH_SECRET` generated
- [ ] HTTPS enforced (Traefik handles this)
- [ ] Supabase service role key protected
- [ ] API keys not exposed in client code
- [ ] Database not exposed publicly (internal network only)

---

## Monitoring

### Health Endpoint
```
GET https://yourdomain.com/api/health
Response: { "status": "healthy", "timestamp": "..." }
```

### Dokploy Monitoring
- CPU/Memory usage in dashboard
- Container logs
- Deployment history

### Recommended Additions
- Sentry for error tracking
- Uptime monitoring (UptimeRobot, Better Uptime)
- Log aggregation (if needed)

---

## Contact & Support

- **Dokploy Docs**: https://docs.dokploy.com
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Prisma**: https://www.prisma.io/docs
