# Mental Wellness AI - DevOps Documentation

Welcome to the DevOps setup for the Mental Wellness AI platform! This directory contains all the infrastructure, deployment, and operational configurations needed to run the application securely and at scale.

## 🚀 Quick Start

### For Development
```powershell
# Windows
cd devops\scripts
.\dev-setup.ps1 setup
.\dev-setup.ps1 start

# Linux/macOS
cd devops/scripts
chmod +x dev-setup.sh
./dev-setup.sh setup
./dev-setup.sh start
```

### Access Points
- **Backend API**: http://localhost:5000
- **API Health**: http://localhost:5000/health
- **Nginx**: http://localhost:80
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090

## 📁 Directory Structure

```
devops/
├── docker-compose.yml          # Production Docker Compose
├── docker-compose.dev.yml      # Development Docker Compose
├── CI-CD-SETUP.md             # GitHub Actions setup guide
├── .github/
│   └── workflows/
│       └── ci-cd.yml          # Complete CI/CD pipeline
├── nginx/
│   ├── nginx.conf             # Nginx reverse proxy config
│   └── ssl/                   # SSL certificates
├── monitoring/
│   ├── prometheus.yml         # Metrics collection
│   ├── loki.yml              # Log aggregation
│   ├── promtail.yml          # Log shipping
│   ├── alert_rules.yml       # Alerting rules
│   └── grafana/              # Dashboard configurations
└── scripts/
    ├── dev-setup.sh          # Linux/macOS development setup
    ├── dev-setup.ps1         # Windows development setup
    ├── backup.sh             # HIPAA-compliant backups
    ├── restore-backup.sh     # Backup restoration
    └── security-hardening.sh # Security configuration
```

## 🏗️ Infrastructure Components

### Core Services
- **Backend API**: Node.js application with Express
- **MongoDB**: Document database for user data
- **Redis**: Session store and caching
- **Nginx**: Reverse proxy and load balancer

### Monitoring Stack
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization and dashboards
- **Loki**: Log aggregation
- **Promtail**: Log shipping

### Security & Compliance
- **HIPAA-compliant** data handling
- **End-to-end encryption** for sensitive data
- **Automated backups** with encryption
- **Security scanning** in CI/CD
- **Audit logging** for compliance

## 🛡️ Security & HIPAA Compliance

### Security Features
- ✅ **Data Encryption**: AES-256 encryption at rest and TLS 1.2+ in transit
- ✅ **Access Controls**: Role-based authentication and authorization
- ✅ **Audit Logging**: Comprehensive audit trails for all data access
- ✅ **Backup Encryption**: GPG-encrypted automated backups
- ✅ **Security Scanning**: Automated vulnerability assessments
- ✅ **Data Retention**: Automated data lifecycle management

### HIPAA Requirements Met
- ✅ **Administrative Safeguards**: Access controls and workforce training
- ✅ **Physical Safeguards**: Secure infrastructure and data centers
- ✅ **Technical Safeguards**: Encryption, audit logs, and access controls
- ✅ **Business Associate Agreements**: Vendor compliance verification

## 🔧 Development Setup

### Prerequisites
- Docker Desktop 4.0+
- Docker Compose 2.0+
- Git
- PowerShell 5.1+ (Windows) or Bash (Linux/macOS)

### Environment Configuration
1. Copy `.env.example` to `.env`
2. Update the following critical variables:
   ```bash
   MONGO_ROOT_PASSWORD=your-secure-password
   JWT_SECRET=your-super-secret-jwt-key
   OPENAI_API_KEY=your-openai-api-key
   GEMINI_API_KEY=your-gemini-api-key
   HIPAA_ENCRYPTION_KEY=your-32-character-encryption-key
   ```

### Development Commands
```bash
# Setup and start all services
./scripts/dev-setup.sh setup
./scripts/dev-setup.sh start

# View service status
./scripts/dev-setup.sh status

# View logs
./scripts/dev-setup.sh logs
./scripts/dev-setup.sh logs backend

# Stop services
./scripts/dev-setup.sh stop

# Clean up everything
./scripts/dev-setup.sh cleanup
```

## 🚀 Deployment

### CI/CD Pipeline
The GitHub Actions workflow provides:
- **Automated Testing**: Unit, integration, and security tests
- **Security Scanning**: OWASP dependency check and Trivy scans
- **HIPAA Compliance**: Automated compliance verification
- **Multi-Environment**: Staging and production deployments
- **Zero-Downtime**: Rolling deployments with health checks

### Deployment Environments
1. **Development**: Local development with hot reload
2. **Staging**: Pre-production testing environment
3. **Production**: Live production environment

### Setup Instructions
See [CI-CD-SETUP.md](CI-CD-SETUP.md) for complete setup instructions including:
- Required GitHub secrets
- Server configuration
- Environment variables
- Troubleshooting guide

## 📊 Monitoring & Observability

### Metrics Dashboard
Access Grafana at http://localhost:3001 with admin/admin:
- **Application Metrics**: Request rates, response times, error rates
- **System Metrics**: CPU, memory, disk usage
- **Business Metrics**: User activity, crisis detections
- **Security Metrics**: Authentication failures, suspicious activity

### Alerting Rules
Automated alerts for:
- **Critical**: Service outages, security incidents
- **Warning**: High resource usage, elevated error rates
- **Info**: Deployment notifications, backup status

### Log Aggregation
Centralized logging with:
- **Structured Logging**: JSON format with correlation IDs
- **Log Retention**: 90-day retention for HIPAA compliance
- **Search & Analysis**: Full-text search capabilities
- **Real-time Monitoring**: Live log streaming

## 💾 Backup & Recovery

### Automated Backups
- **Schedule**: Daily at 2 AM UTC
- **Retention**: 30 days local, 90 days cloud storage
- **Encryption**: GPG encryption with rotating keys
- **Verification**: Automated integrity checks

### Backup Commands
```bash
# Manual backup
docker-compose exec backup /backup.sh

# Restore from backup
./scripts/restore-backup.sh backup_file.tar.gz.gpg

# Verify backup integrity
./scripts/restore-backup.sh backup_file.tar.gz.gpg --verify-only
```

### Recovery Procedures
1. **Database Recovery**: Point-in-time restoration from encrypted backups
2. **Application Recovery**: Container rollback to previous versions
3. **Disaster Recovery**: Full infrastructure recreation from code

## 🔒 Security Hardening

### Security Script
Run the security hardening script to apply HIPAA-compliant security measures:
```bash
./scripts/security-hardening.sh
```

This script configures:
- File system permissions
- Network firewall rules
- Service security settings
- Audit logging
- Data anonymization checks
- Security monitoring

### Security Checklist
- [ ] Environment variables secured
- [ ] SSL certificates configured
- [ ] Firewall rules applied
- [ ] Audit logging enabled
- [ ] Backup encryption verified
- [ ] Access controls implemented
- [ ] Security monitoring active

## 📈 Performance Optimization

### Application Performance
- **Database Indexing**: Optimized MongoDB indexes
- **Caching Strategy**: Redis caching for frequent queries
- **Connection Pooling**: Efficient database connections
- **Compression**: Gzip compression for API responses

### Infrastructure Scaling
- **Horizontal Scaling**: Load balancer configuration
- **Resource Limits**: Container resource constraints
- **Auto-Scaling**: Kubernetes-ready configurations
- **CDN Integration**: Static asset optimization

## 🆘 Troubleshooting

### Common Issues

#### Services Not Starting
```bash
# Check Docker status
docker --version
docker info

# Check service logs
docker-compose logs

# Restart services
docker-compose restart
```

#### Database Connection Issues
```bash
# Verify MongoDB is running
docker-compose ps mongodb

# Check MongoDB logs
docker-compose logs mongodb

# Test connection
docker-compose exec backend node -e "console.log('MongoDB URI:', process.env.MONGODB_URI)"
```

#### Memory Issues
```bash
# Check resource usage
docker stats

# Clean up unused resources
docker system prune -f

# Restart specific service
docker-compose restart backend
```

### Getting Help
1. **Check Service Status**: `./scripts/dev-setup.sh status`
2. **View Logs**: `./scripts/dev-setup.sh logs [service]`
3. **Validate Environment**: `./scripts/dev-setup.sh validate`
4. **Contact DevOps Team**: See [CI-CD-SETUP.md](CI-CD-SETUP.md) for contact info

## 🔄 Maintenance

### Regular Tasks
- **Daily**: Monitor application health and security alerts
- **Weekly**: Review backup status and log aggregation
- **Monthly**: Security updates and dependency patches
- **Quarterly**: Security audits and compliance reviews

### Health Checks
```bash
# Application health
curl http://localhost:5000/health

# Database health
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Redis health
docker-compose exec redis redis-cli ping
```

## 📚 Additional Resources

- [CI/CD Setup Guide](CI-CD-SETUP.md)
- [Security Hardening Documentation](scripts/security-hardening.sh)
- [Backup & Recovery Procedures](scripts/backup.sh)
- [Monitoring Configuration](monitoring/)
- [HIPAA Compliance Checklist](#security--hipaa-compliance)

## 🤝 Contributing

### DevOps Contributions
1. Test changes in development environment
2. Update documentation for any configuration changes
3. Ensure security compliance for all modifications
4. Update monitoring and alerting as needed

### Code Review Requirements
- [ ] Security review for any credential changes
- [ ] Performance impact assessment
- [ ] HIPAA compliance verification
- [ ] Documentation updates

---

## 📞 Support

### Emergency Contacts
- **DevOps Team**: devops@mental-wellness-ai.com
- **Security Team**: security@mental-wellness-ai.com
- **On-Call**: +1-XXX-XXX-XXXX

### Documentation
- **API Documentation**: https://docs.mental-wellness-ai.com
- **Monitoring Runbooks**: Grafana dashboards
- **Security Procedures**: Internal security wiki

---

*Mental Wellness AI DevOps Team*  
*Last Updated: September 20, 2025*