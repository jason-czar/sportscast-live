#!/bin/bash

# Production deployment script for Telegram Live Streaming Platform
set -e

echo "🚀 Starting production deployment..."

# Check if required environment variables are set
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found. Copy .env.example to .env and fill in your values."
    exit 1
fi

# Load environment variables
source .env

# Validate required variables
required_vars=("TELEGRAM_API_ID" "TELEGRAM_API_HASH" "SUPABASE_URL" "SUPABASE_ANON_KEY")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: $var is not set in .env file"
        exit 1
    fi
done

echo "✅ Environment variables validated"

# Build Docker images
echo "🔨 Building Docker images..."
docker-compose -f docker-compose.yml build --no-cache

# Start services
echo "🐳 Starting services..."
docker-compose -f docker-compose.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
timeout 300 bash -c 'until docker-compose -f docker-compose.yml ps | grep -q "healthy"; do sleep 5; done'

# Check service status
echo "📊 Service status:"
docker-compose -f docker-compose.yml ps

# Test TDLib service
echo "🧪 Testing TDLib service..."
curl -f http://localhost:8080/health || echo "⚠️  TDLib service health check failed"

# Test WebRTC bridge
echo "🧪 Testing WebRTC bridge..."
curl -f http://localhost:8081/health || echo "⚠️  WebRTC bridge health check failed"

echo "✅ Production deployment completed!"
echo ""
echo "🌐 Services are running on:"
echo "  - Application: http://localhost:3000"
echo "  - TDLib Service: http://localhost:8080"
echo "  - WebRTC Bridge: http://localhost:8081"
echo ""
echo "📋 Next steps:"
echo "  1. Configure your domain and SSL certificates"
echo "  2. Set up monitoring and alerting"
echo "  3. Configure backup for TDLib data"
echo "  4. Test Telegram authentication with real credentials"