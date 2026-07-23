#!/bin/sh
set -e

if echo "SELECT 1 FROM _prisma_migrations LIMIT 1;" | npx prisma db execute --stdin 2>/dev/null; then
  echo "Migration tracking table exists, running pending migrations..."
  npx prisma migrate deploy
else
  echo "No migration tracking table found"
  if echo "SELECT 1 FROM users LIMIT 1;" | npx prisma db execute --stdin 2>/dev/null; then
    echo "Legacy database detected (tables exist from earlier db push)"
    echo "Marking all existing migrations as applied..."
    for dir in prisma/migrations/*/; do
      name=$(basename "$dir")
      echo "  Resolving: $name"
      npx prisma migrate resolve --applied "$name"
    done
    echo "Done. Database will be tracked going forward."
  else
    echo "Fresh database, running all migrations..."
    npx prisma migrate deploy
  fi
fi

echo "Running seed..."
npx tsx prisma/seed.ts

echo "Starting server..."
exec npx tsx src/index.ts
