#!/bin/bash

case "$1" in
  create)
    docker exec -it powerlink-postgres createdb -U ${DB_USERNAME:-postgres} ${DB_NAME:-powerlink_core}
    echo "✅ Database created"
    ;;
  drop)
    docker exec -it powerlink-postgres dropdb -U ${DB_USERNAME:-postgres} ${DB_NAME:-powerlink_core}
    echo "✅ Database dropped"
    ;;
  reset)
    docker exec -it powerlink-postgres dropdb -U ${DB_USERNAME:-postgres} ${DB_NAME:-powerlink_core}
    docker exec -it powerlink-postgres createdb -U ${DB_USERNAME:-postgres} ${DB_NAME:-powerlink_core}
    echo "✅ Database reset"
    ;;
  psql)
    docker exec -it powerlink-postgres psql -U ${DB_USERNAME:-postgres} ${DB_NAME:-powerlink_core}
    ;;
  migrate)
    pnpm -F api-gateway db:migrate
    ;;
  seed)
    pnpm -F api-gateway db:seed
    ;;
  *)
    echo "Usage: $0 {create|drop|reset|psql|migrate|seed}"
    exit 1
    ;;
esac
