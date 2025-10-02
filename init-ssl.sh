#!/bin/bash

# SSL Certificate Initialization Script
# This script helps you set up SSL certificates for production deployment

set -e

echo "==================================="
echo "SSL Certificate Setup"
echo "==================================="
echo ""

# Check if domain is provided
if [ -z "$1" ]; then
    echo "Usage: ./init-ssl.sh <domain> <email> [staging]"
    echo ""
    echo "Arguments:"
    echo "  domain  - Your domain name (e.g., example.com)"
    echo "  email   - Your email for Let's Encrypt notifications"
    echo "  staging - Optional: Use 'staging' for testing (avoids rate limits)"
    echo ""
    echo "Examples:"
    echo "  ./init-ssl.sh example.com admin@example.com"
    echo "  ./init-ssl.sh example.com admin@example.com staging"
    echo ""
    echo "For self-signed certificate (testing only):"
    echo "  ./init-ssl.sh self-signed"
    exit 1
fi

DOMAIN=$1
EMAIL=$2
STAGING_ARG=$3

# Create necessary directories
mkdir -p nginx/ssl/live

# Self-signed certificate for testing
if [ "$DOMAIN" = "self-signed" ]; then
    echo "Creating self-signed certificate for testing..."
    echo "⚠️  WARNING: Self-signed certificates should only be used for testing!"
    echo ""
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/live/privkey.pem \
        -out nginx/ssl/live/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
    
    echo "✅ Self-signed certificate created successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Update your .env file:"
    echo "   NEXTAUTH_URL=https://localhost"
    echo ""
    echo "2. Start the application:"
    echo "   docker-compose -f docker-compose.prod.yml up -d"
    echo ""
    echo "3. Accept the browser security warning (self-signed cert)"
    exit 0
fi

# Validate email for Let's Encrypt
if [ -z "$EMAIL" ]; then
    echo "❌ Error: Email is required for Let's Encrypt certificates"
    echo "Usage: ./init-ssl.sh <domain> <email> [staging]"
    exit 1
fi

echo "Domain: $DOMAIN"
echo "Email: $EMAIL"

# Check if using staging environment
if [ "$STAGING_ARG" = "staging" ]; then
    STAGING="--staging"
    echo "Environment: Staging (for testing)"
    echo "⚠️  Staging certificates are not trusted by browsers but help avoid rate limits"
else
    STAGING=""
    echo "Environment: Production"
fi

echo ""
echo "==================================="
echo "Step 1: Creating dummy certificate"
echo "==================================="
echo ""

# Create dummy certificate to start nginx
openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
    -keyout nginx/ssl/live/privkey.pem \
    -out nginx/ssl/live/cert.pem \
    -subj "/CN=$DOMAIN"

echo "✅ Dummy certificate created"
echo ""

echo "==================================="
echo "Step 2: Starting nginx"
echo "==================================="
echo ""

# Start nginx to respond to http-01 challenge
docker-compose -f docker-compose.prod.yml up -d nginx

echo "✅ Nginx started"
echo "⏳ Waiting for nginx to be ready..."
sleep 5

echo ""
echo "==================================="
echo "Step 3: Obtaining SSL certificate"
echo "==================================="
echo ""

# Request Let's Encrypt certificate
docker-compose -f docker-compose.prod.yml run --rm certbot \
    certonly --webroot --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    $STAGING \
    -d $DOMAIN

# Check if certificate was obtained successfully
if [ ! -f "nginx/ssl/live/$DOMAIN/fullchain.pem" ]; then
    echo "❌ Failed to obtain certificate"
    echo ""
    echo "Troubleshooting:"
    echo "1. Ensure domain $DOMAIN points to this server's IP address"
    echo "2. Check that ports 80 and 443 are accessible"
    echo "3. Try using staging mode first: ./init-ssl.sh $DOMAIN $EMAIL staging"
    echo "4. Check logs: docker-compose -f docker-compose.prod.yml logs certbot"
    exit 1
fi

echo "✅ Certificate obtained successfully!"
echo ""

echo "==================================="
echo "Step 4: Creating certificate symlinks"
echo "==================================="
echo ""

# Replace dummy certificate with real one
rm nginx/ssl/live/privkey.pem
rm nginx/ssl/live/cert.pem
ln -s ../live/$DOMAIN/privkey.pem nginx/ssl/live/privkey.pem
ln -s ../live/$DOMAIN/fullchain.pem nginx/ssl/live/cert.pem

echo "✅ Certificate symlinks created"
echo ""

echo "==================================="
echo "Step 5: Reloading nginx"
echo "==================================="
echo ""

# Reload nginx to use the new certificate
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo "✅ Nginx reloaded with new certificate"
echo ""

echo "==================================="
echo "✅ SSL Setup Complete!"
echo "==================================="
echo ""
echo "Your application is now secured with SSL/TLS!"
echo ""
echo "Next steps:"
echo "1. Update your .env file:"
echo "   NEXTAUTH_URL=https://$DOMAIN"
echo ""
echo "2. Start all services:"
echo "   docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "3. Access your application at:"
echo "   https://$DOMAIN"
echo ""
echo "Certificate auto-renewal:"
echo "  Certbot will automatically renew certificates every 12 hours"
echo ""
if [ "$STAGING_ARG" = "staging" ]; then
    echo "⚠️  IMPORTANT: You used staging mode!"
    echo "   Browsers will not trust this certificate."
    echo "   Run again without 'staging' for production:"
    echo "   ./init-ssl.sh $DOMAIN $EMAIL"
    echo ""
fi

