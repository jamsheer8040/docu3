#!/usr/bin/env bash
# ==============================================================================
# DocClear Docker Deployment Script for folderex.online
# ==============================================================================
set -e

echo "=================================================="
echo "🚀 Starting DocClear Docker Deployment"
echo "🌐 Domain: folderex.online"
echo "=================================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first: https://docs.docker.com/engine/install/"
    exit 1
fi

# Detect docker compose plugin or standalone docker-compose
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "❌ Docker Compose is not installed. Please install Docker Compose."
    exit 1
fi

# Ensure .env file exists
if [ ! -f .env ]; then
    echo "📄 Creating .env from .env.example..."
    cp .env.example .env
fi

# Remove any conflicting containers from previous runs
echo "🧹 Removing any conflicting containers..."
docker rm -f docclear_db docclear_backend docclear_frontend 2>/dev/null || true

# Build and start containers
echo "🔨 Launching containers..."
$DOCKER_COMPOSE down --remove-orphans || true
$DOCKER_COMPOSE up -d --build

echo "⏳ Waiting for database and backend initialization..."
sleep 15

# Check status
echo "📊 Container status:"
$DOCKER_COMPOSE ps

echo ""
echo "=================================================="
echo "✅ Docker deployment completed successfully!"
echo "=================================================="
echo ""
echo "Next Steps for Nginx & SSL on your host server:"
echo "1. Copy Nginx configuration:"
echo "   sudo cp docu_nginx.conf /etc/nginx/sites-available/folderex.online"
echo "   sudo ln -sf /etc/nginx/sites-available/folderex.online /etc/nginx/sites-enabled/"
echo ""
echo "2. Test and reload Nginx:"
echo "   sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "3. Obtain Free SSL Certificate via Certbot:"
echo "   sudo certbot --nginx -d folderex.online -d www.folderex.online"
echo ""
echo "Default Administrator Login:"
echo "  URL:      https://folderex.online/login"
echo "  Email:    admin@folderex.online"
echo "  Password: Admin@Folderex2026 (or custom password set in .env)"
echo "=================================================="
