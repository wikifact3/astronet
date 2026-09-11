#!/bin/bash
set -euo pipefail

echo "🚀 Setting up PowerLink development environment..."

# ---------- 1. Dependencies ----------
echo "📦 Installing dependencies..."
pnpm install

# ---------- 2. Env file ----------
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ Created .env from example"
else
  echo "⚠️  .env already exists, skipping"
fi

# ---------- 3. Docker services ----------
echo "🐳 Starting Docker services..."
./scripts/docker-manage.sh up

# ---------- 4. Wait for Postgres to accept connections ----------
echo "⏳ Waiting for PostgreSQL to accept connections..."
MAX_ATTEMPTS=30
ATTEMPT=0
until docker exec powerlink-postgres pg_isready -U "${DB_USERNAME:-postgres}" -q; do
  ATTEMPT=$((ATTEMPT + 1))
  if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    echo "❌ PostgreSQL did not become ready after ${MAX_ATTEMPTS} attempts"
    echo "   Check: docker logs powerlink-postgres"
    exit 1
  fi
  echo "   ...attempt $ATTEMPT/$MAX_ATTEMPTS"
  sleep 2
done
echo "✅ PostgreSQL is accepting connections"

# ---------- 5. Verify port reachable from host ----------
echo "🔍 Verifying Postgres port is reachable from host..."
if ! (echo > /dev/tcp/localhost/5432) 2>/dev/null; then
  echo "❌ Cannot reach localhost:5432 from host"
  echo "   Check: docker ps | grep powerlink-postgres"
  echo "   Check: docker port powerlink-postgres"
  exit 1
fi
echo "✅ Port 5432 is reachable"

# ---------- 6. Create database if missing ----------
echo "📊 Ensuring database exists..."
DB_NAME_FINAL="${DB_NAME:-powerlink_core}"
if docker exec powerlink-postgres psql -U "${DB_USERNAME:-postgres}" -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${DB_NAME_FINAL}'" | grep -q 1; then
  echo "✅ Database '${DB_NAME_FINAL}' already exists"
else
  docker exec powerlink-postgres psql -U "${DB_USERNAME:-postgres}" \
    -c "CREATE DATABASE ${DB_NAME_FINAL}"
  echo "✅ Database '${DB_NAME_FINAL}' created"
fi

# ---------- 7. Run migrations ----------
echo "🔄 Running database migrations..."
if ! pnpm -F api-gateway db:migrate; then
  echo "❌ Migrations failed"
  echo "   Try: docker logs powerlink-postgres"
  exit 1
fi
echo "✅ Migrations completed"

# ---------- 8. Run seeds ----------
echo "🌱 Seeding database..."
if ! pnpm -F api-gateway db:seed; then
  echo "❌ Seeding failed"
  exit 1
fi
echo "✅ Seeds completed"

# ---------- 9. Done ----------
echo ""
echo "✅ Development environment ready!"
echo ""
echo "📋 Services:"
echo "  - API Gateway:       http://localhost:8080"
echo "  - Marketing Site:    http://localhost:3000"
echo "  - Customer Portal:   http://localhost:3001"
echo "  - Admin Portal:      http://localhost:3002"
echo "  - PostgreSQL:        localhost:5432"
echo "  - TimescaleDB:       localhost:5433"
echo "  - Redis:             localhost:6379"
echo "  - Redis Commander:   http://localhost:8081"
echo "  - MailHog:           http://localhost:8025"
echo ""
echo "🔑 Default DB credentials:"
echo "  user: ${DB_USERNAME:-postgres} / pass: ${DB_PASSWORD:-postgres}"
