#!/bin/sh
set -e

# ===========================================
# DietAIbook Docker Entrypoint
# Runs database migrations before starting app
# ===========================================

echo "=========================================="
echo "DietAIbook Container Starting..."
echo "=========================================="

# Wait for database to be ready (extra safety beyond healthcheck)
echo "[1/3] Waiting for database connection..."
sleep 2

# Run Prisma migrations (use local version)
echo "[2/3] Running database migrations..."
./node_modules/.bin/prisma db push --accept-data-loss

echo "[3/3] Starting Next.js application..."
echo "=========================================="

# Start the application
exec node server.js
