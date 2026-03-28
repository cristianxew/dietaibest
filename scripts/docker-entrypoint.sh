#!/bin/sh
set -e

# ===========================================
# DietAI Docker Entrypoint
# Runs database migrations before starting app
# ===========================================

echo "=========================================="
echo "DietAI Container Starting..."
echo "=========================================="

# Wait for database to be ready (extra safety beyond healthcheck)
echo "[1/3] Waiting for database connection..."
sleep 2

# Run Prisma migrations (use globally installed CLI)
echo "[2/3] Running database migrations..."
prisma migrate deploy --schema=./prisma/schema.prisma

echo "[3/3] Starting Next.js application..."
echo "=========================================="

# Start the application
exec node server.js
