#!/bin/bash

case "$1" in
  unit)
    pnpm test -- --testMatch="**/*.spec.ts"
    ;;
  integration)
    pnpm test -- --testMatch="**/*.integration.spec.ts"
    ;;
  e2e)
    pnpm test -- --testMatch="**/*.e2e.spec.ts"
    ;;
  coverage)
    pnpm test:cov
    ;;
  all)
    pnpm test
    ;;
  *)
    echo "Usage: $0 {unit|integration|e2e|coverage|all}"
    exit 1
    ;;
esac
