# Production Deployment Quick Start

This guide will get your application running in production with HTTPS in under 10 minutes.

## Prerequisites

- ✅ Server with Docker and Docker Compose installed
- ✅ Domain name pointing to your server's IP address
- ✅ Ports 80 and 443 open on your firewall

## Step-by-Step Deployment

### 1. Clone Repository

```bash
git clone <your-repo-url>
cd rahunu-registry
```

### 2. Set Up SSL Certificate

**For production with Let's Encrypt (Recommended):**

```bash
# Make script executable
chmod +x init-ssl.sh

# Run SSL setup (replace with your domain and email)
./init-ssl.sh yourdomain.com admin@yourdomain.com
```

**For testing with staging certificate:**

```bash
./init-ssl.sh yourdomain.com admin@yourdomain.com staging
```

**For local testing with self-signed certificate:**

```bash
./init-ssl.sh self-signed
```

### 3. Create Environment File

```bash
cat > .env << EOF
AUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=https://yourdomain.com
POSTGRES_PASSWORD=$(openssl rand -base64 32)
EOF
```

**Important:** Replace `yourdomain.com` with your actual domain!

### 4. Start All Services

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 5. Verify Deployment

```bash
# Check all services are running
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 6. Access Your Application

Open your browser and navigate to:
```
https://yourdomain.com
```

## Default Credentials

First-time setup will seed an admin user:
- **Email:** admin@example.com
- **Password:** admin123

⚠️ **IMPORTANT:** Change these credentials immediately after first login!

## Common Issues

### Issue: ERR_SSL_PROTOCOL_ERROR

**Cause:** SSL certificate not properly configured

**Fix:**
```bash
# Verify certificates exist
ls -la nginx/ssl/live/

# Check nginx logs
docker-compose -f docker-compose.prod.yml logs nginx

# Restart nginx
docker-compose -f docker-compose.prod.yml restart nginx
```

### Issue: Can't Obtain Certificate

**Cause:** Domain not pointing to server or ports blocked

**Fix:**
1. Verify DNS: `nslookup yourdomain.com`
2. Check firewall: `sudo ufw status`
3. Open ports:
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

### Issue: Database Connection Failed

**Fix:**
```bash
# Check database logs
docker-compose -f docker-compose.prod.yml logs db

# Restart database
docker-compose -f docker-compose.prod.yml restart db
```

## Management Commands

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f web
docker-compose -f docker-compose.prod.yml logs -f nginx
docker-compose -f docker-compose.prod.yml logs -f db
```

### Restart Services

```bash
# All services
docker-compose -f docker-compose.prod.yml restart

# Specific service
docker-compose -f docker-compose.prod.yml restart web
docker-compose -f docker-compose.prod.yml restart nginx
```

### Stop Services

```bash
docker-compose -f docker-compose.prod.yml down
```

### Update Application

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build
```

### Database Backup

```bash
# Create backup
docker-compose -f docker-compose.prod.yml exec db \
  pg_dump -U rahunu rahunu > backup-$(date +%Y%m%d).sql

# Restore backup
docker-compose -f docker-compose.prod.yml exec -T db \
  psql -U rahunu rahunu < backup-20250101.sql
```

## Security Checklist

After deployment, verify:

- [ ] SSL certificate is valid and trusted
- [ ] HTTPS redirect is working (HTTP → HTTPS)
- [ ] Default admin password has been changed
- [ ] Database is not exposed externally
- [ ] Firewall is configured (only ports 80, 443, and SSH)
- [ ] Regular backups are scheduled
- [ ] Logs are being monitored

Test your SSL configuration:
- [SSL Labs Test](https://www.ssllabs.com/ssltest/)
- Expected grade: A or A+

## File Structure

```
rahunu-registry/
├── docker-compose.prod.yml   # Production configuration
├── init-ssl.sh                # SSL setup script
├── .env                       # Environment variables (create this)
├── nginx/                     # Nginx configuration
│   ├── nginx.conf
│   ├── conf.d/
│   │   └── app.conf
│   └── ssl/                   # SSL certificates
├── storage/
│   └── uploads/               # File uploads
└── prisma/
    └── schema.prisma          # Database schema
```

## Monitoring

### Check Certificate Expiration

```bash
docker-compose -f docker-compose.prod.yml run --rm certbot certificates
```

### View Certificate Details

```bash
openssl x509 -in nginx/ssl/live/cert.pem -text -noout | grep -A 2 Validity
```

### Health Checks

```bash
# Application health
curl -f https://yourdomain.com/api/auth/providers

# Database health
docker-compose -f docker-compose.prod.yml exec db pg_isready -U rahunu
```

## Scaling and Performance

### Increase Resources

Edit `docker-compose.prod.yml` to limit/reserve resources:

```yaml
services:
  web:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### Database Optimization

```bash
# Connect to database
docker-compose -f docker-compose.prod.yml exec db psql -U rahunu -d rahunu

# Check database size
SELECT pg_size_pretty(pg_database_size('rahunu'));

# Vacuum database
VACUUM ANALYZE;
```

## Additional Documentation

- [SSL Setup Guide](./SSL_SETUP.md) - Detailed SSL configuration
- [Docker Guide](./README_DOCKER.md) - Complete Docker documentation
- [Security Audit](./SECURITY_AUDIT_REPORT.md) - Security review
- [Environment Setup](./ENVIRONMENT_SETUP.md) - Development setup

## Support

If you encounter issues:

1. Check logs: `docker-compose -f docker-compose.prod.yml logs`
2. Verify configuration: `docker-compose -f docker-compose.prod.yml config`
3. Review [SSL_SETUP.md](./SSL_SETUP.md) for SSL issues
4. Check [Common Issues](#common-issues) section above

## Maintenance

### Regular Tasks

**Daily:**
- Monitor logs for errors
- Check disk space

**Weekly:**
- Review security logs
- Test backups

**Monthly:**
- Update Docker images
- Review and update dependencies
- Rotate secrets

### Updates

```bash
# Update Docker images
docker-compose -f docker-compose.prod.yml pull

# Update application
git pull
docker-compose -f docker-compose.prod.yml up -d --build

# Update dependencies
docker-compose -f docker-compose.prod.yml exec web npm update
```

## Next Steps

1. ✅ Configure application settings via admin panel
2. ✅ Set up automated backups
3. ✅ Configure monitoring (e.g., Uptime Robot, Datadog)
4. ✅ Set up log aggregation
5. ✅ Review and customize user roles
6. ✅ Train users on the system

Congratulations! Your application is now running securely in production! 🎉

