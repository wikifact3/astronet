#!/bin/bash

ENVIRONMENT=${1:-staging}

echo "🚀 Deploying to $ENVIRONMENT..."

case "$ENVIRONMENT" in
  staging)
    ./infrastructure/deploy-staging.sh
    ;;
  production)
    echo "⚠️  Deploying to production requires manual approval"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "❌ Deployment cancelled"
      exit 1
    fi
    ./infrastructure/deploy-production.sh
    ;;
  *)
    echo "Usage: $0 {staging|production}"
    exit 1
    ;;
esac
