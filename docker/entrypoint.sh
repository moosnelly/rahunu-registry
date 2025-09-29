#!/bin/sh
set -e

if [ -n "$UPLOAD_DIR" ]; then
  echo "Ensuring upload directory at $UPLOAD_DIR"
  mkdir -p "$UPLOAD_DIR"
fi

echo "Prisma migrate deploy..."
npx prisma migrate deploy

echo "Starting Next.js..."
npm run start -- -p 3000
