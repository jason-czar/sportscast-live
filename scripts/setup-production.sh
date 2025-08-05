#!/bin/bash

# Setup script for production environment
set -e

echo "🔧 Setting up production environment for Telegram Live Streaming..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root or with sudo"
    exit 1
fi

# Update system
echo "📦 Updating system packages..."
apt-get update && apt-get upgrade -y

# Install Docker and Docker Compose
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    
    # Add current user to docker group (if not root)
    if [ "$SUDO_USER" ]; then
        usermod -aG docker $SUDO_USER
        echo "👤 Added $SUDO_USER to docker group"
    fi
fi

# Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Install FFmpeg (for the host system)
echo "🎥 Installing FFmpeg..."
apt-get install -y ffmpeg

# Install additional tools
echo "🔧 Installing additional tools..."
apt-get install -y curl jq htop

# Create application directories
echo "📁 Creating application directories..."
mkdir -p /opt/telegram-streaming
mkdir -p /opt/telegram-streaming/data
mkdir -p /opt/telegram-streaming/logs
mkdir -p /opt/telegram-streaming/backups

# Set permissions
chown -R 1000:1000 /opt/telegram-streaming

# Configure firewall
echo "🔥 Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw allow 8080/tcp
ufw allow 8081/tcp
ufw --force enable

# Configure log rotation
echo "📋 Setting up log rotation..."
cat > /etc/logrotate.d/telegram-streaming << EOF
/opt/telegram-streaming/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    notifempty
    create 644 1000 1000
    postrotate
        docker-compose -f /opt/telegram-streaming/docker-compose.yml restart 2>/dev/null || true
    endscript
}
EOF

# Create systemd service for automatic startup
echo "⚙️ Creating systemd service..."
cat > /etc/systemd/system/telegram-streaming.service << EOF
[Unit]
Description=Telegram Live Streaming Platform
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/telegram-streaming
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable telegram-streaming

# Install monitoring tools
echo "📊 Setting up monitoring..."
mkdir -p /opt/telegram-streaming/monitoring

# Create backup script
echo "💾 Creating backup script..."
cat > /opt/telegram-streaming/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/telegram-streaming/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup TDLib data
docker run --rm -v telegram-streaming_tdlib_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/tdlib_data_$DATE.tar.gz -C /data .

# Backup logs
tar czf $BACKUP_DIR/logs_$DATE.tar.gz -C /opt/telegram-streaming/logs .

# Clean old backups (keep last 7 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /opt/telegram-streaming/backup.sh

# Schedule daily backups
echo "⏰ Setting up daily backups..."
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/telegram-streaming/backup.sh") | crontab -

echo "✅ Production environment setup completed!"
echo ""
echo "📋 Next steps:"
echo "  1. Copy your project files to /opt/telegram-streaming/"
echo "  2. Create and configure the .env file"
echo "  3. Run the deployment script: ./deploy.sh"
echo "  4. Configure your domain and SSL certificates"
echo ""
echo "🔧 Useful commands:"
echo "  - Start services: systemctl start telegram-streaming"
echo "  - Stop services: systemctl stop telegram-streaming"
echo "  - View logs: docker-compose -f /opt/telegram-streaming/docker-compose.yml logs"
echo "  - Run backup: /opt/telegram-streaming/backup.sh"