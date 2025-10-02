# Docker Deployment Guide

## Quick Start (Local Testing)

For local testing with Docker:

```bash
# Generate AUTH_SECRET
export AUTH_SECRET=$(openssl rand -base64 32)

# Start the application
docker-compose up -d

# Access at http://localhost:3000
```

The default `docker-compose.yml` is configured for **local testing** with HTTP.

---

## Production Deployment with HTTPS

🚀 **For production deployment, see [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) for the complete guide.**

### Quick Production Setup

```bash
# 1. Set up SSL certificate (automated)
chmod +x init-ssl.sh
./init-ssl.sh your-domain.com admin@your-domain.com

# 2. Create environment file
cat > .env << EOF
AUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=https://your-domain.com
POSTGRES_PASSWORD=$(openssl rand -base64 24)
EOF

# 3. Start all services
docker-compose -f docker-compose.prod.yml up -d

# 4. Access at https://your-domain.com
```

### What's Included

The production setup includes:
- ✅ **Nginx** reverse proxy with SSL termination
- ✅ **Let's Encrypt** automatic SSL certificates
- ✅ **Certbot** for automatic certificate renewal
- ✅ **Security headers** and HTTPS enforcement
- ✅ **PostgreSQL** database (internal network only)

### Documentation

- [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) - Quick start guide
- [SSL_SETUP.md](./SSL_SETUP.md) - Detailed SSL configuration
- [SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md) - Security review

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AUTH_SECRET` | NextAuth secret (min 32 chars) | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Application URL | Local: `http://localhost:3000`<br>Production: `https://your-domain.com` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | Database password | `rahunu` (local only) |
| `UPLOAD_DIR` | Upload directory | `/app/storage/uploads` |

---

## Common Issues & Solutions

### Issue: HTTPS Redirect Error

**Symptoms:**
- App loads on HTTP
- Login redirects to HTTPS
- Connection refused error

**Cause:**
NextAuth.js requires `NEXTAUTH_URL` environment variable. Without it, NextAuth enforces HTTPS in production mode.

**Solution:**
1. **For local testing:** Use default `docker-compose.yml` (already configured)
2. **For production:** Set `NEXTAUTH_URL=https://your-domain.com` in `.env` file

### Issue: AUTH_SECRET Required Error

**Solution:**
```bash
# Generate and set AUTH_SECRET
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env
```

### Issue: Database Connection Failed

**Check:**
1. Database service is healthy: `docker-compose ps`
2. Check logs: `docker-compose logs db`
3. Verify DATABASE_URL format is correct

---

## File Structure

```
rahunu-registry/
├── docker-compose.yml       # Local testing (HTTP)
├── docker-compose.dev.yml   # Development with hot reload
├── docker-compose.prod.yml  # Production (HTTPS required)
├── Dockerfile               # Application container
├── .env                     # Environment variables (create this)
└── .env.example             # Example environment file
```

---

## Docker Compose Files Comparison

| File | Purpose | NEXTAUTH_URL | Database Port Exposed | NODE_ENV |
|------|---------|--------------|----------------------|----------|
| `docker-compose.yml` | Local testing | Defaults to HTTP | Yes (5432) | production |
| `docker-compose.dev.yml` | Development | HTTP | Yes (5432) | development |
| `docker-compose.prod.yml` | Production | HTTPS required | No | production |

---

## Commands

### Start Services
```bash
# Local testing
docker-compose up -d

# Development with hot reload
docker-compose -f docker-compose.dev.yml up

# Production
docker-compose -f docker-compose.prod.yml up -d
```

### Stop Services
```bash
docker-compose down
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f web
docker-compose logs -f db
```

### Rebuild
```bash
# Rebuild without cache
docker-compose build --no-cache

# Rebuild and restart
docker-compose up -d --build
```

### Database Management
```bash
# Run migrations
docker-compose exec web npx prisma migrate deploy

# Access database shell
docker-compose exec db psql -U rahunu -d rahunu

# Backup database
docker-compose exec db pg_dump -U rahunu rahunu > backup.sql

# Restore database
docker-compose exec -T db psql -U rahunu rahunu < backup.sql
```

---

## Production Checklist

Before deploying to production:

- [ ] Generate strong `AUTH_SECRET` (32+ characters)
- [ ] Set `NEXTAUTH_URL` to HTTPS URL
- [ ] Use strong `POSTGRES_PASSWORD`
- [ ] Set up SSL/TLS certificate (Let's Encrypt recommended)
- [ ] Configure reverse proxy (Nginx/Caddy)
- [ ] Set up firewall rules
- [ ] Configure database backups
- [ ] Set up monitoring and logging
- [ ] Test SSL/TLS configuration (https://www.ssllabs.com/ssltest/)
- [ ] Enable automatic container restarts
- [ ] Review security headers
- [ ] Set up log rotation

---

## Security Best Practices

1. **Never expose database port** in production
2. **Use HTTPS only** in production
3. **Generate unique secrets** for each environment
4. **Rotate secrets** regularly (every 90 days)
5. **Use Docker secrets** for sensitive data in swarm mode
6. **Keep containers updated** regularly
7. **Limit container resources** (CPU, memory)
8. **Use read-only file systems** where possible
9. **Run containers as non-root** user
10. **Enable Docker security scanning**

---

## Monitoring

### Health Checks

The application includes health checks:
- Database: `pg_isready` check every 5 seconds
- Web: HTTP check on `/api/auth/providers` every 30 seconds

### View Health Status
```bash
docker-compose ps
```

### Restart Unhealthy Containers
```bash
docker-compose restart web
```

---

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker-compose logs web

# Check environment variables
docker-compose exec web env | grep -E 'AUTH_SECRET|NEXTAUTH_URL|DATABASE_URL'
```

### Database Connection Issues
```bash
# Test database connectivity
docker-compose exec web npx prisma db pull

# Check database status
docker-compose exec db pg_isready -U rahunu
```

### Reset Everything
```bash
# Stop and remove everything (⚠️ destroys data)
docker-compose down -v
docker-compose up -d
```

---

## Support

For more information:
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [NextAuth.js Configuration](https://next-auth.js.org/configuration/options)
- [Prisma with Docker](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-docker)
