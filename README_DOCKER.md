# Docker Setup Guide

This project uses Docker for both development and production deployments with PostgreSQL as the database.

## Prerequisites

- Docker
- Docker Compose

## Environment Variables

Copy `.env.example` to `.env` and adjust the values:

```bash
cp .env.example .env
```

**Important:** Generate a secure `AUTH_SECRET` for production:

```bash
openssl rand -base64 32
```

## Development Environment

Use `docker-compose.dev.yml` for development with hot-reload:

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Stop development environment
docker-compose -f docker-compose.dev.yml down

# Stop and remove volumes (fresh start)
docker-compose -f docker-compose.dev.yml down -v
```

**Development Features:**
- PostgreSQL database: `rahunu_dev`
- Hot-reload enabled
- Source code mounted as volume
- Runs on `http://localhost:3000`
- Database accessible on `localhost:5432`

## Production Environment

Use `docker-compose.yml` for production:

```bash
# Build and start production environment
docker-compose up -d

# View logs
docker-compose logs -f

# Stop production environment
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

**Production Features:**
- PostgreSQL database: `rahunu`
- Optimized multi-stage Docker build
- Auto-runs database migrations on startup
- Persistent volumes for database and uploads
- Runs on `http://localhost:3000`

## Database Management

### Run Migrations

Migrations are automatically applied on container startup via the entrypoint script.

To manually run migrations:

```bash
# Development
docker-compose -f docker-compose.dev.yml exec web npx prisma migrate deploy

# Production
docker-compose exec web npx prisma migrate deploy
```

### Create New Migration

```bash
# Development (local)
npx prisma migrate dev --name your_migration_name

# Then restart containers to apply
docker-compose -f docker-compose.dev.yml restart web
```

### Access Database

```bash
# Development
docker-compose -f docker-compose.dev.yml exec db psql -U rahunu -d rahunu_dev

# Production
docker-compose exec db psql -U rahunu -d rahunu
```

### Seed Database

```bash
# Development
docker-compose -f docker-compose.dev.yml exec web npm run seed

# Production
docker-compose exec web npm run seed
```

## Volumes

The setup uses Docker volumes for data persistence:

### Development
- `dbdev`: PostgreSQL data
- `uploads_dev`: File uploads
- Source code mounted from `./` to `/app`

### Production
- `db`: PostgreSQL data
- `uploads`: File uploads

## Troubleshooting

### Port Already in Use

If port 3000 or 5432 is already in use, modify the ports in the compose file:

```yaml
ports:
  - "3001:3000"  # Map to different host port
```

### Database Connection Issues

Ensure the database health check passes before the web service starts. This is configured in the compose files with `depends_on` and health checks.

### Reset Everything

To completely reset (⚠️ this deletes all data):

```bash
# Development
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up

# Production
docker-compose down -v
docker-compose up -d
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f web
docker-compose logs -f db
```

## Production Deployment

For production deployment on a server:

1. Set secure environment variables:
   ```bash
   export AUTH_SECRET="your-secure-secret-here"
   export AUTH_URL="https://yourdomain.com"
   ```

2. Update database credentials in `docker-compose.yml`

3. Consider using a reverse proxy (nginx, traefik) for HTTPS

4. Set up regular database backups:
   ```bash
   docker-compose exec db pg_dump -U rahunu rahunu > backup_$(date +%Y%m%d).sql
   ```

## Architecture

### Dockerfile (Multi-stage Build)
1. **deps**: Installs dependencies
2. **builder**: Generates Prisma client and builds Next.js
3. **runner**: Minimal production image with only necessary files

### Services
- **db**: PostgreSQL 15 database
- **web**: Next.js application

## File Uploads

Uploaded files are stored in Docker volumes:
- Development: `uploads_dev` volume mounted at `/app/storage/uploads`
- Production: `uploads` volume mounted at `/app/storage/uploads`

These volumes persist even when containers are stopped, ensuring files are not lost.