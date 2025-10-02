# SSL/HTTPS Setup Guide

This guide will help you set up SSL/HTTPS for your production deployment using Let's Encrypt certificates.

## Prerequisites

1. **Domain name** pointing to your server's IP address
2. **Ports 80 and 443** open and accessible from the internet
3. **Docker and Docker Compose** installed

## Quick Setup

### Option 1: Automated Setup with Let's Encrypt (Recommended)

```bash
# Make the script executable
chmod +x init-ssl.sh

# Run the SSL initialization script
./init-ssl.sh your-domain.com admin@your-domain.com

# Example:
./init-ssl.sh example.com admin@example.com
```

This will:
- Create initial dummy certificates
- Start Nginx
- Obtain Let's Encrypt SSL certificate
- Configure automatic certificate renewal
- Set up secure HTTPS

### Option 2: Testing with Staging Certificates

If you want to test without hitting Let's Encrypt rate limits:

```bash
./init-ssl.sh your-domain.com admin@your-domain.com staging
```

⚠️ **Note:** Staging certificates are not trusted by browsers but are useful for testing.

### Option 3: Self-Signed Certificate (Development Only)

For local testing or development:

```bash
./init-ssl.sh self-signed
```

⚠️ **Warning:** Self-signed certificates will show browser warnings. Only use for testing!

## Manual Setup

If you prefer to set up SSL manually:

### Step 1: Create .env File

```bash
cat > .env << EOF
AUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=https://your-domain.com
POSTGRES_PASSWORD=$(openssl rand -base64 24)
EOF
```

### Step 2: Start Services

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Step 3: Obtain Certificate

```bash
# Request certificate from Let's Encrypt
docker-compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot --webroot-path=/var/www/certbot \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d your-domain.com
```

### Step 4: Update Nginx Configuration

Update `nginx/conf.d/app.conf` with your domain and certificate paths.

### Step 5: Reload Nginx

```bash
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

## Architecture

```
Internet → [Port 443/HTTPS] → Nginx (SSL Termination) → Next.js App (Port 3000/HTTP)
           [Port 80/HTTP]  → Nginx (Redirect to HTTPS)
```

### Components

1. **Nginx**: Reverse proxy handling SSL/TLS termination
2. **Certbot**: Automatic SSL certificate management
3. **Next.js App**: Your application running on port 3000
4. **PostgreSQL**: Database (internal network only)

## Certificate Renewal

Certificates are automatically renewed by Certbot:

- Certbot checks for renewal every 12 hours
- Certificates are renewed 30 days before expiration
- No manual intervention required

To manually renew:

```bash
docker-compose -f docker-compose.prod.yml run --rm certbot renew
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

## Configuration Files

### Nginx Configuration

- `nginx/nginx.conf` - Main Nginx configuration
- `nginx/conf.d/app.conf` - Application reverse proxy configuration

### SSL Certificates

- `nginx/ssl/live/cert.pem` - SSL certificate (symlink)
- `nginx/ssl/live/privkey.pem` - Private key (symlink)
- `nginx/ssl/live/<domain>/` - Actual Let's Encrypt certificates

## Troubleshooting

### 1. ERR_SSL_PROTOCOL_ERROR

**Problem:** Browser shows SSL protocol error

**Solutions:**
- Ensure certificates are properly installed: `ls -la nginx/ssl/live/`
- Check Nginx is running: `docker-compose -f docker-compose.prod.yml ps`
- View Nginx logs: `docker-compose -f docker-compose.prod.yml logs nginx`
- Verify NEXTAUTH_URL uses https: `echo $NEXTAUTH_URL`

### 2. Certificate Not Obtained

**Problem:** Certbot fails to obtain certificate

**Solutions:**
1. Verify domain DNS points to your server:
   ```bash
   nslookup your-domain.com
   ```

2. Check ports 80 and 443 are accessible:
   ```bash
   # On your server
   sudo netstat -tlnp | grep -E ':(80|443)'
   ```

3. Ensure no firewall blocking:
   ```bash
   # Ubuntu/Debian
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   
   # CentOS/RHEL
   sudo firewall-cmd --permanent --add-service=http
   sudo firewall-cmd --permanent --add-service=https
   sudo firewall-cmd --reload
   ```

4. Try staging mode first:
   ```bash
   ./init-ssl.sh your-domain.com your-email@example.com staging
   ```

### 3. Nginx Configuration Errors

**Problem:** Nginx fails to start or reload

**Check configuration:**
```bash
docker-compose -f docker-compose.prod.yml exec nginx nginx -t
```

**View detailed logs:**
```bash
docker-compose -f docker-compose.prod.yml logs nginx
```

### 4. Certificate Expired

**Problem:** Certificate has expired

**Solution:**
```bash
# Force renewal
docker-compose -f docker-compose.prod.yml run --rm certbot renew --force-renewal
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

### 5. Mixed Content Warnings

**Problem:** Browser shows mixed content (HTTP resources on HTTPS page)

**Solution:**
Ensure `NEXTAUTH_URL` is set to HTTPS in your `.env` file:
```bash
NEXTAUTH_URL=https://your-domain.com
```

Then restart services:
```bash
docker-compose -f docker-compose.prod.yml restart web
```

## Security Best Practices

### SSL/TLS Configuration

The Nginx configuration includes:

✅ TLS 1.2 and 1.3 only (no older protocols)  
✅ Strong cipher suites  
✅ HTTP Strict Transport Security (HSTS)  
✅ Security headers (X-Frame-Options, X-Content-Type-Options, etc.)  
✅ Automatic HTTP to HTTPS redirect

### Monitoring

Check certificate expiration:
```bash
docker-compose -f docker-compose.prod.yml run --rm certbot certificates
```

View certificate details:
```bash
openssl x509 -in nginx/ssl/live/cert.pem -text -noout
```

Test SSL configuration:
- [SSL Labs Test](https://www.ssllabs.com/ssltest/)
- [Mozilla Observatory](https://observatory.mozilla.org/)

## Let's Encrypt Rate Limits

- **50 certificates** per registered domain per week
- **5 duplicate certificates** per week
- Use **staging mode** for testing to avoid hitting limits

Reference: [Let's Encrypt Rate Limits](https://letsencrypt.org/docs/rate-limits/)

## Updating Configuration

### Update Domain

If you need to change your domain:

1. Update `.env` file:
   ```bash
   NEXTAUTH_URL=https://new-domain.com
   ```

2. Obtain new certificate:
   ```bash
   ./init-ssl.sh new-domain.com your-email@example.com
   ```

3. Restart services:
   ```bash
   docker-compose -f docker-compose.prod.yml restart
   ```

### Add Multiple Domains

To support multiple domains (e.g., www and non-www):

```bash
docker-compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot --webroot-path=/var/www/certbot \
  --email your-email@example.com \
  --agree-tos \
  -d example.com \
  -d www.example.com
```

Update `nginx/conf.d/app.conf` to list all domains in `server_name`:
```nginx
server_name example.com www.example.com;
```

## Advanced Configuration

### Custom SSL Settings

Edit `nginx/conf.d/app.conf` to customize:

- SSL protocols
- Cipher suites
- Security headers
- Proxy settings
- Upload limits

After changes, reload Nginx:
```bash
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

### Using External Certificates

If you have certificates from another provider:

1. Copy certificates to `nginx/ssl/live/`:
   ```bash
   cp your-cert.pem nginx/ssl/live/cert.pem
   cp your-key.pem nginx/ssl/live/privkey.pem
   ```

2. Update permissions:
   ```bash
   chmod 644 nginx/ssl/live/cert.pem
   chmod 600 nginx/ssl/live/privkey.pem
   ```

3. Reload Nginx:
   ```bash
   docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
   ```

## Support

For issues or questions:

1. Check logs: `docker-compose -f docker-compose.prod.yml logs`
2. Verify configuration: `docker-compose -f docker-compose.prod.yml config`
3. Review Let's Encrypt documentation: [https://letsencrypt.org/docs/](https://letsencrypt.org/docs/)

## Next Steps

After SSL is configured:

1. ✅ Test your site at `https://your-domain.com`
2. ✅ Verify SSL rating at [SSL Labs](https://www.ssllabs.com/ssltest/)
3. ✅ Set up monitoring and backups
4. ✅ Review [SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md)
5. ✅ Configure application settings

