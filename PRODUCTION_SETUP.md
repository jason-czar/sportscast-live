# Production Setup Guide

This guide provides step-by-step instructions for deploying the Telegram Live Streaming Platform to production.

## Prerequisites

Before starting the deployment, ensure you have:

1. **Telegram API Credentials**
   - API ID and API Hash from [my.telegram.org](https://my.telegram.org)
   - Bot Token from [@BotFather](https://t.me/botfather)
   - Phone number registered with Telegram

2. **Infrastructure**
   - Ubuntu 20.04+ server with at least 4GB RAM
   - Docker and Docker Compose installed
   - Domain name (optional, for SSL)

3. **Supabase Project**
   - URL and service keys
   - Edge functions deployed

## Quick Start

### 1. Server Setup

Run the automated setup script as root:

```bash
curl -fsSL https://raw.githubusercontent.com/your-repo/telegram-streaming/main/scripts/setup-production.sh | sudo bash
```

This script will:
- Install Docker and Docker Compose
- Install FFmpeg and required tools
- Configure firewall and system services
- Set up monitoring and backup automation

### 2. Application Deployment

1. Clone your repository to `/opt/telegram-streaming/`:
```bash
cd /opt/telegram-streaming
git clone https://github.com/your-repo/telegram-streaming .
```

2. Copy and configure environment variables:
```bash
cp production/.env.example .env
nano .env
```

Fill in all required values:
```env
# Supabase Configuration
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Telegram Configuration
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_PHONE=your_phone_number

# Environment
ENVIRONMENT=production
```

3. Deploy the application:
```bash
cd production
chmod +x deploy.sh
./deploy.sh
```

### 3. SSL Configuration (Optional)

For production with a domain name:

1. Install Certbot:
```bash
sudo apt install certbot python3-certbot-nginx
```

2. Obtain SSL certificate:
```bash
sudo certbot --nginx -d your-domain.com
```

3. Update nginx configuration to use your domain

## Architecture Overview

The production deployment includes:

### Core Services

1. **TDLib Service** (Port 8080)
   - Real TDLib integration for Telegram API
   - Session management and authentication
   - RTMP stream configuration

2. **WebRTC-RTMP Bridge** (Port 8081)
   - FFmpeg-based stream conversion
   - WebRTC peer connection handling
   - Real-time stream processing

3. **Main Application** (Port 3000)
   - React frontend
   - Supabase integration
   - WebRTC streaming interface

4. **Nginx Reverse Proxy** (Port 80/443)
   - SSL termination
   - Load balancing
   - Security headers

### Monitoring & Logging

- **Prometheus**: Metrics collection
- **Grafana**: Monitoring dashboards
- **Log rotation**: Automated log management
- **Health checks**: Service availability monitoring

## Configuration Details

### TDLib Service Configuration

The TDLib service requires:
- Valid Telegram API credentials
- Persistent data volume for session storage
- Proper network access to Telegram servers

Key environment variables:
```env
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
ENVIRONMENT=production
```

### WebRTC Bridge Configuration

The WebRTC bridge handles:
- Browser WebRTC connections
- FFmpeg process management
- RTMP stream output

Configuration options:
```env
FFMPEG_THREADS=4
MAX_CONCURRENT_STREAMS=10
ENVIRONMENT=production
```

### Security Configuration

Production security measures:
- Rate limiting on API endpoints
- SSL/TLS encryption
- Security headers
- Firewall configuration
- Input validation and sanitization

## Testing the Deployment

### 1. Service Health Checks

```bash
# Check all services
docker-compose -f /opt/telegram-streaming/docker-compose.yml ps

# Test TDLib service
curl http://localhost:8080/health

# Test WebRTC bridge
curl http://localhost:8081/health

# Test main application
curl http://localhost:3000
```

### 2. Telegram Authentication

1. Open the application in a browser
2. Navigate to Telegram authentication
3. Enter your phone number
4. Verify with the code from Telegram
5. Confirm successful authentication

### 3. Streaming Test

1. Create a test event
2. Join as a camera
3. Start streaming to Telegram
4. Verify stream appears in Telegram channel

## Monitoring and Maintenance

### Daily Operations

- Monitor service logs: `docker-compose logs -f`
- Check system resources: `htop`
- Verify backup completion: `/opt/telegram-streaming/backup.sh`

### Performance Monitoring

Access monitoring dashboards:
- Prometheus: `http://your-server:9090`
- Grafana: `http://your-server:3001`

Key metrics to monitor:
- Stream latency and quality
- FFmpeg process health
- System resource usage
- Error rates and failures

### Backup and Recovery

Automated daily backups include:
- TDLib session data
- Application logs
- Configuration files

Backup location: `/opt/telegram-streaming/backups/`

Recovery procedure:
1. Stop services: `systemctl stop telegram-streaming`
2. Restore data: Extract backup to data volumes
3. Start services: `systemctl start telegram-streaming`

## Troubleshooting

### Common Issues

1. **TDLib Authentication Fails**
   - Verify API credentials are correct
   - Check phone number format (include country code)
   - Ensure Telegram account is active

2. **FFmpeg Process Crashes**
   - Check system resources (CPU/memory)
   - Verify FFmpeg installation
   - Review error logs for specific issues

3. **WebRTC Connection Issues**
   - Configure TURN servers for NAT traversal
   - Check firewall settings
   - Verify SSL certificates for HTTPS

### Log Locations

- Application logs: `/opt/telegram-streaming/logs/`
- Docker logs: `docker-compose logs [service-name]`
- System logs: `/var/log/syslog`

### Support

For additional support:
1. Check the troubleshooting documentation
2. Review GitHub issues
3. Contact the development team

## Scaling Considerations

For high-traffic deployments:

1. **Horizontal Scaling**
   - Deploy multiple WebRTC bridge instances
   - Use load balancer for distribution
   - Scale FFmpeg processing capacity

2. **Performance Optimization**
   - Optimize FFmpeg encoding settings
   - Implement CDN for stream distribution
   - Use dedicated TURN servers

3. **Cost Management**
   - Monitor bandwidth usage
   - Implement adaptive bitrate streaming
   - Use spot instances for processing

## Security Hardening

Additional security measures:
- Regular security updates
- Network segmentation
- Access control and auditing
- Vulnerability scanning
- Incident response procedures