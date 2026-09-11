#!/bin/bash
set -euo pipefail

case "$1" in
  up)
    # --wait blocks until all services with healthchecks are healthy
    # --wait-timeout gives up after N seconds
    docker compose up -d --wait --wait-timeout 120
    echo "✅ All services are up and healthy"
    ;;
  down)
    docker compose down
    echo "✅ All services stopped"
    ;;
  logs)
    docker compose logs -f "${@:2}"
    ;;
  restart)
    docker compose restart "${@:2}"
    ;;
  clean)
    docker compose down -v
    docker system prune -f
    echo "✅ Cleaned up volumes and containers"
    ;;
  *)
    echo "Usage: $0 {up|down|logs|restart|clean} [service-name]"
    exit 1
    ;;
esac
