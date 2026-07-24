#!/bin/sh
set -e

if echo "SELECT 1 FROM _prisma_migrations LIMIT 1;" | pnpm prisma db execute --stdin 2>/dev/null; then
  echo "Migration tracking table exists, running pending migrations..."
  pnpm prisma migrate deploy
else
  echo "No migration tracking table found"
  if echo "SELECT 1 FROM users LIMIT 1;" | pnpm prisma db execute --stdin 2>/dev/null; then
    echo "Legacy database detected (tables exist from earlier db push)"
    echo "Marking all existing migrations as applied..."
    for dir in prisma/migrations/*/; do
      name=$(basename "$dir")
      echo "  Resolving: $name"
      pnpm prisma migrate resolve --applied "$name"
    done
    echo "Done. Database will be tracked going forward."
  else
    echo "Fresh database, running all migrations..."
    pnpm prisma migrate deploy
  fi
fi

echo "Starting server..."
exec pnpm tsx src/index.ts
