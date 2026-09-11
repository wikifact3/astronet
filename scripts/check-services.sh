#!/bin/bash
set -euo pipefail

echo "🔍 Checking PowerLink services..."
echo ""

FAILED=0

check_service() {
  local name="$1"
  local cmd="$2"
  if eval "$cmd" &>/dev/null; then
    echo "  ✅ $name"
  else
    echo "  ❌ $name"
    FAILED=$((FAILED + 1))
  fi
}

check_service "PostgreSQL container"      "docker ps --format '{{.Names}}' | grep -q '^powerlink-postgres$'"
check_service "PostgreSQL accepting conns" "docker exec powerlink-postgres pg_isready -U \${DB_USERNAME:-postgres} -q"
check_service "PostgreSQL port 5432 open" "bash -c '</dev/tcp/localhost/5432'"
check_service "TimescaleDB container"      "docker ps --format '{{.Names}}' | grep -q '^powerlink-timescaledb$'"
check_service "TimescaleDB port 5433 open" "bash -c '</dev/tcp/localhost/5433'"
check_service "Redis container"            "docker ps --format '{{.Names}}' | grep -q '^powerlink-redis$'"
check_service "Redis PING"                 "docker exec powerlink-redis redis-cli ping | grep -q PONG"
check_service "Redis port 6379 open"       "bash -c '</dev/tcp/localhost/6379'"

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "✅ All services healthy"
  exit 0
else
  echo "❌ $FAILED service(s) unhealthy"
  echo ""
  echo "Troubleshooting:"
  echo "  docker ps -a | grep powerlink"
  echo "  docker logs powerlink-postgres"
  echo "  ./scripts/docker-manage.sh up"
  exit 1
fi
