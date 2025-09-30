# Migration Guide: SQLite to PostgreSQL

Your project has been updated to use PostgreSQL for both development and production. Since your existing migrations are SQLite-specific, you need to regenerate them for PostgreSQL.

## What Was Changed

1. ✅ `prisma/schema.prisma` - Updated datasource provider from `sqlite` to `postgresql`
2. ✅ `Dockerfile` - Added `next.config.js` to production build
3. ✅ `docker-compose.yml` - Already configured for PostgreSQL (production)
4. ✅ `docker-compose.dev.yml` - Already configured for PostgreSQL (development)
5. ✅ `.env.example` - Created with PostgreSQL connection strings
6. ✅ `.dockerignore` - Created to optimize Docker builds
7. ✅ `README_DOCKER.md` - Updated with comprehensive Docker usage guide

## Required Actions

### Option 1: Fresh Start with Docker (Recommended for New Projects)

If you don't need to preserve existing data:

```bash
# 1. Remove old SQLite-specific migrations
rm -rf prisma/migrations

# 2. Start PostgreSQL database with Docker
docker-compose -f docker-compose.dev.yml up db -d

# 3. Wait for database to be ready (check with)
docker-compose -f docker-compose.dev.yml logs db

# 4. Create new PostgreSQL migrations
npx prisma migrate dev --name init

# 5. Start the full application
docker-compose -f docker-compose.dev.yml up
```

### Option 2: Local PostgreSQL Setup

If you want to develop locally without Docker:

```bash
# 1. Install PostgreSQL locally
# macOS: brew install postgresql
# Windows: Download from postgresql.org
# Linux: sudo apt-get install postgresql

# 2. Create a database
createdb rahunu_dev

# 3. Create .env file
cp .env.example .env

# 4. Update DATABASE_URL in .env
DATABASE_URL="postgresql://yourusername:yourpassword@localhost:5432/rahunu_dev?schema=public"

# 5. Remove old migrations
rm -rf prisma/migrations

# 6. Create new migrations
npx prisma migrate dev --name init

# 7. Run the application
npm run dev
```

### Option 3: Data Migration (If You Have Important Data)

If you need to preserve data from SQLite:

```bash
# 1. Export data from SQLite
# Use a tool like prisma studio or write a custom script

# 2. Follow Option 1 or 2 above to set up PostgreSQL

# 3. Import data into PostgreSQL
# Use your exported data and Prisma client to seed the database
```

## Verifying the Setup

After migration, verify everything works:

```bash
# Generate Prisma client
npx prisma generate

# Check database connection
npx prisma db push

# Open Prisma Studio to inspect database
npx prisma studio
```

## Docker Environment Variables

The Docker Compose files use these PostgreSQL configurations:

### Development (`docker-compose.dev.yml`)
- Database: `rahunu_dev`
- User: `rahunu`
- Password: `rahunu`
- Port: `5432` (exposed to host)
- Connection: `postgresql://rahunu:rahunu@db:5432/rahunu_dev?schema=public`

### Production (`docker-compose.yml`)
- Database: `rahunu`
- User: `rahunu`
- Password: `rahunu` (⚠️ Change in production!)
- Port: `5432` (internal only)
- Connection: `postgresql://rahunu:rahunu@db:5432/rahunu?schema=public`

## Important Notes

1. **Migrations**: The existing migrations in `prisma/migrations/` use SQLite syntax (`DATETIME`, `INTEGER PRIMARY KEY`, etc.) which won't work with PostgreSQL. You MUST regenerate them.

2. **Database File**: The `prisma/dev.db` file is no longer used and can be deleted.

3. **Backup**: If you have important data in the SQLite database, back it up before switching.

4. **Production Credentials**: Change the default PostgreSQL password in `docker-compose.yml` for production deployments!

5. **Data Types**: PostgreSQL handles some data types differently than SQLite:
   - Dates are stored as proper `TIMESTAMP` instead of `TEXT`
   - Decimals have better precision
   - JSON is a native type

## Troubleshooting

### Error: "relation does not exist"
This means migrations haven't been applied. Run:
```bash
npx prisma migrate deploy
```

### Error: "Can't reach database server"
- Check if PostgreSQL is running: `docker-compose -f docker-compose.dev.yml ps`
- Verify DATABASE_URL is correct
- Check if port 5432 is available

### Error: "Migration failed"
- Delete `prisma/migrations/` folder
- Run `npx prisma migrate dev --name init` to start fresh

## Next Steps

After successful migration:

1. Test all application features
2. Run the seed script if needed: `npm run seed`
3. Verify uploads directory works
4. Test authentication
5. Deploy to production using `docker-compose.yml`

For detailed Docker usage, see [README_DOCKER.md](./README_DOCKER.md).
