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

**Billing (Stripe) — required for the /subscribe page and webhooks:**
```
STRIPE_SECRET_KEY=<sk_live_...>
STRIPE_WEBHOOK_SECRET=<whsec_... from Stripe dashboard → Webhooks>
STRIPE_TRIAL_DAYS=14   # optional, defaults to 14
```

> ⚠️ These are **server-side runtime** vars. Beyond adding them in the Dokploy
> Environment UI, they MUST also be declared in the `app` service `environment:`
> block of `docker-compose.yml` — otherwise the container never receives them.
> See "Env Var Set in Dokploy But Container Can't See It" below.

**Important:** `NEXT_PUBLIC_*` variables are embedded into the JavaScript at **build time**.
If you change these values, you must trigger a **full rebuild** (not just restart) for changes to take effect.

**Optional:**
```
GOOGLE_CLIENT_ID=<for-google-oauth>
GOOGLE_CLIENT_SECRET=<for-google-oauth>
SUPABASE_SERVICE_ROLE_KEY=<for-admin-operations>
BROWSER_USE_API_KEY=<for-ai-web-automation>
CRON_SECRET=<auth for /api/cron/* endpoints>
ENTITLEMENTS_ENFORCED=true        # gate Pro features
CHAT_COST_CAP_ENFORCED=true       # enforce chat spend cap
CHAT_LLM_MODEL=<override chat model>
GEMMA_MODEL=<vertex gemma model>
GOOGLE_VERTEX_LOCATION=<vertex region>
FEATURE_MULTIMODAL_IMPORT=true
# Google Cloud (Vertex AI — Gemma extraction + Imagen images — AND Document AI OCR)
GOOGLE_CLOUD_PROJECT_ID=<gcp-project-id>
GOOGLE_VERTEX_LOCATION=us-central1
DOCUMENT_AI_LOCATION=eu
DOCUMENT_AI_CUSTOM_PROCESSOR_ID=<processor-id>
# PREFERRED: full service-account JSON as a single-line value — see below
GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...",...}
```

> All of these must be declared in the `app` service `environment:` block of
> `docker-compose.yml` to reach the container — the Dokploy Environment UI alone
> is not enough (see the env troubleshooting section).

#### Google service-account credentials (inline JSON env var — preferred)

The same service account authenticates **Vertex AI** (Gemma recipe extraction +
Imagen image generation) and **Document AI** (recipe OCR). All three resolve
credentials through `resolveGoogleServiceAccountAuth`
(`src/lib/chat/tools/genai-options.ts`): inline JSON first, key-file path second.

**Provide the credential as a single env var — do NOT use a Dokploy File Mount.**
A File Mount does **not** reach the container in a Compose-type deployment: the
running process gets `ENOENT` on the configured path, so Vertex/Document AI fail
with `"transient"` / `"All promises were rejected"`. The env var rides the
compose `environment:` block like every other secret and is delivered reliably.

1. Minify the service-account JSON to a single line (it already is if downloaded
   from GCP; otherwise `jq -c . key.json`). The `private_key` newlines are
   `\n`-escaped inside the JSON string and survive as-is.
2. Dokploy → service → **Environment**, add:
   `GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON={"type":"service_account",...}`
3. Confirm it is also declared in the `app` `environment:` block of
   `docker-compose.yml` (it is, by default — `GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON`).
4. Redeploy.

The JSON is a **secret** — never commit it or bake it into the image.

> Legacy file-path fallback: if `GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON` is unset, the
> code falls back to `GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH` (`keyFilename`). That
> only works if the file genuinely exists **inside the container** at that path —
> verify with `docker exec <app> ls -la "$GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH"`.

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

### Env Var Set in Dokploy But Container Can't See It

**Symptom:** A feature fails with `<VAR> is not set` even though you added the
variable in the Dokploy **Environment** section. (E.g. `STRIPE_SECRET_KEY is not set`
on the `/subscribe` page.)

**Cause:** The Dokploy Environment UI only writes a `.env` file next to the compose
file. Compose uses it for `${VAR}` **interpolation** — it does NOT inject the
variable into the container. The container only receives vars **explicitly listed**
in the service's `environment:` (or `env_file:`) block.

**Solution:**
1. Add the variable to the `app` service `environment:` block in `docker-compose.yml`:
   ```yaml
   environment:
     - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
   ```
2. Commit + push (triggers Dokploy auto-deploy) **or** redeploy in Dokploy.
3. A plain restart is NOT enough if the compose file changed — redeploy so the new
   compose definition is applied.

> Reminder: `NEXT_PUBLIC_*` vars also need a **build arg** in `build.args` +
> `Dockerfile`, plus a full rebuild — runtime `environment:` alone won't reach the
> client bundle.

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

| Setting           | Value                                                                   |
| ----------------- | ----------------------------------------------------------------------- |
| **Site URL**      | `https://yourdomain.com` (exact match, with https)                      |
| **Redirect URLs** | `https://yourdomain.com/**` — wildcard, covers every locale prefix      |
|                   | `https://yourdomain.com/api/auth/callback/google`                       |

The wildcard matters: app pages are locale-prefixed (`/es/auth/callback`,
`/pl/auth/reset-password`), and an unlisted `redirect_to` makes Supabase
**silently fall back to the Site URL** — the user lands on the landing page
with no error anywhere.

**Note:** Email/password login doesn't use redirect URLs - those are for magic links, password reset and OAuth only.

### Magic Link / Password Reset Opens a 404

**Symptom:** The link in the email opens the "This page could not be found" page.

**Cause:** The target page does not live under `src/app/[locale]/`. The
next-intl middleware (`localePrefix: "as-needed"`) rewrites `/auth/callback` to
`/en/auth/callback`, so a page stored outside `[locale]` resolves to nothing.
This shipped broken until 2026-08-01.

**Solution:** Keep every email-reachable page under
`src/app/[locale]/(public-pages)/` and list it in `PUBLIC_ROUTES` in
`src/middleware.ts`. Verify with a raw request — the rewrite header names the
route Next.js actually tried:

```bash
curl -s -D - -o /dev/null https://yourdomain.com/auth/callback | grep -iE 'HTTP|x-middleware-rewrite'
```

Full detail: [Auth email links SOP](../SOP/auth-email-links.md).

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
