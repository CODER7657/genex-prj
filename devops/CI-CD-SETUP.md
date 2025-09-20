# Mental Wellness AI - CI/CD Setup Documentation
## GitHub Secrets and Environment Configuration

This document provides the complete setup guide for the CI/CD pipeline, including all required GitHub secrets and environment configurations.

## Table of Contents
1. [Required GitHub Secrets](#required-github-secrets)
2. [Environment Variables](#environment-variables)
3. [Repository Setup](#repository-setup)
4. [Deployment Environments](#deployment-environments)
5. [Security Configuration](#security-configuration)
6. [Troubleshooting](#troubleshooting)

---

## Required GitHub Secrets

### Production Deployment Secrets
Add these secrets to your GitHub repository under **Settings → Secrets and variables → Actions**:

#### Server Access
```
PRODUCTION_HOST=your-production-server-ip
PRODUCTION_USERNAME=deploy-user
PRODUCTION_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----
...your private key content...
-----END OPENSSH PRIVATE KEY-----
PRODUCTION_PORT=22
```

#### Staging Environment
```
STAGING_HOST=your-staging-server-ip
STAGING_USERNAME=deploy-user
STAGING_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----
...your staging private key content...
-----END OPENSSH PRIVATE KEY-----
STAGING_PORT=22
```

#### Application URLs
```
PRODUCTION_URL=https://api.mental-wellness-ai.com
STAGING_URL=https://staging-api.mental-wellness-ai.com
```

#### Container Registry
```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
# (This is automatically provided by GitHub Actions)
```

#### Notification Services
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/xxx/xxx
```

---

## Environment Variables

### Required for All Environments
These should be set in your deployment environments (staging/production):

#### Database Configuration
```bash
MONGO_ROOT_USERNAME=your-mongo-username
MONGO_ROOT_PASSWORD=your-secure-mongo-password
MONGODB_URI=mongodb://username:password@mongodb:27017/mental_wellness_ai?authSource=admin
REDIS_PASSWORD=your-secure-redis-password
REDIS_URL=redis://:password@redis:6379
```

#### Security Configuration
```bash
JWT_SECRET=your-super-secure-jwt-secret-key-minimum-32-characters
HIPAA_ENCRYPTION_KEY=your-hipaa-encryption-key-exactly-32-chars
BACKUP_ENCRYPTION_KEY=your-backup-encryption-key-32-chars
```

#### AI Service APIs
```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_API_KEY=your-gemini-api-key-here
```

#### Firebase Configuration
```bash
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
...your firebase private key...
-----END PRIVATE KEY-----
```

#### Monitoring and Logging
```bash
GRAFANA_ADMIN_PASSWORD=your-secure-grafana-password
GRAFANA_ROOT_URL=https://monitoring.mental-wellness-ai.com
SENTRY_DSN=https://xxxxxxxxx@sentry.io/xxxxxxx
LOG_LEVEL=info
```

#### Backup Configuration
```bash
BACKUP_RETENTION_DAYS=30
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_BACKUP_BUCKET=mental-wellness-ai-backups
```

#### CORS and Frontend
```bash
FRONTEND_URL=https://mental-wellness-ai.com
MOBILE_APP_URL=https://app.mental-wellness-ai.com
ALLOWED_ORIGINS=https://mental-wellness-ai.com,https://app.mental-wellness-ai.com
```

---

## Repository Setup

### 1. Enable GitHub Actions
1. Go to your repository on GitHub
2. Navigate to **Settings → Actions → General**
3. Under "Actions permissions", select **"Allow all actions and reusable workflows"**
4. Save the settings

### 2. Set Up Environments
Create two environments in your repository:

#### Staging Environment
1. Go to **Settings → Environments**
2. Click **"New environment"**
3. Name it `staging`
4. Configure protection rules:
   - ✓ Required reviewers: 1
   - ✓ Wait timer: 0 minutes
   - ✓ Deployment branches: `develop` branch only

#### Production Environment
1. Create another environment named `production`
2. Configure protection rules:
   - ✓ Required reviewers: 2
   - ✓ Wait timer: 5 minutes
   - ✓ Deployment branches: `main` branch only

### 3. Add Environment Secrets
For each environment, add the specific secrets:

#### Staging Secrets
```
STAGING_HOST=xxx.xxx.xxx.xxx
STAGING_USERNAME=deploy
STAGING_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----...
STAGING_PORT=22
STAGING_URL=https://staging-api.mental-wellness-ai.com
```

#### Production Secrets
```
PRODUCTION_HOST=xxx.xxx.xxx.xxx
PRODUCTION_USERNAME=deploy
PRODUCTION_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----...
PRODUCTION_PORT=22
PRODUCTION_URL=https://api.mental-wellness-ai.com
```

---

## Deployment Environments

### Development Environment
- **Branch**: Any feature branch
- **Trigger**: Push to any branch (runs tests only)
- **Services**: 
  - Security scanning
  - Unit tests
  - Integration tests
  - Code quality checks

### Staging Environment
- **Branch**: `develop`
- **Trigger**: Push to `develop` branch
- **Services**:
  - All development checks
  - Deployment to staging server
  - End-to-end testing
  - Performance testing

### Production Environment
- **Branch**: `main`
- **Trigger**: Push to `main` branch
- **Services**:
  - All previous checks
  - Production deployment
  - Health checks
  - Smoke tests
  - HIPAA compliance verification
  - Backup verification

---

## Security Configuration

### SSH Key Setup
Generate SSH keys for deployment:

```bash
# Generate a new SSH key pair
ssh-keygen -t ed25519 -C "github-actions-deploy" -f deploy-key

# Copy public key to your servers
ssh-copy-id -i deploy-key.pub deploy@your-server

# Add private key to GitHub Secrets
cat deploy-key | pbcopy  # Copy to clipboard
```

### Server Preparation
On your deployment servers, create a deploy user:

```bash
# Create deploy user
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy

# Set up SSH access
sudo mkdir -p /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo touch /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh

# Add public key to authorized_keys
echo "your-public-key-here" | sudo tee -a /home/deploy/.ssh/authorized_keys

# Set up sudo access for Docker commands
echo "deploy ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/docker-compose" | sudo tee /etc/sudoers.d/deploy
```

### Firewall Configuration
Configure firewall on your servers:

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow monitoring ports (restrict to monitoring servers)
sudo ufw allow from monitoring-server-ip to any port 9090
sudo ufw allow from monitoring-server-ip to any port 3001

# Enable firewall
sudo ufw enable
```

---

## Troubleshooting

### Common Issues

#### 1. SSH Connection Failed
**Error**: `Permission denied (publickey)`

**Solution**:
```bash
# Verify SSH key format in GitHub Secrets
# Ensure the private key includes the full header and footer
-----BEGIN OPENSSH PRIVATE KEY-----
...key content...
-----END OPENSSH PRIVATE KEY-----

# Test SSH connection manually
ssh -i deploy-key deploy@your-server
```

#### 2. Docker Permission Denied
**Error**: `Got permission denied while trying to connect to the Docker daemon`

**Solution**:
```bash
# Add deploy user to docker group
sudo usermod -aG docker deploy

# Or use sudo in deployment scripts
sudo docker-compose up -d
```

#### 3. Environment Variables Not Found
**Error**: `Environment variable not set`

**Solution**:
1. Verify secrets are added to the correct environment in GitHub
2. Check secret names match exactly (case-sensitive)
3. Ensure environment is specified in workflow file

#### 4. Health Check Failures
**Error**: `Health check failed`

**Solution**:
```bash
# Check service logs
docker-compose logs backend

# Verify network connectivity
curl http://localhost:5000/health

# Check if all required environment variables are set
docker-compose exec backend env | grep -E "(MONGO|REDIS|JWT)"
```

#### 5. Backup Failures
**Error**: `Backup upload failed`

**Solution**:
1. Verify AWS credentials are correct
2. Check S3 bucket permissions
3. Ensure backup encryption key is set
4. Verify network connectivity to AWS

### Debugging Workflow Issues

#### View Workflow Logs
1. Go to **Actions** tab in your repository
2. Click on the failed workflow run
3. Click on the failed job
4. Expand the failed step to see detailed logs

#### Enable Debug Logging
Add this secret to enable verbose logging:
```
ACTIONS_RUNNER_DEBUG=true
ACTIONS_STEP_DEBUG=true
```

#### Test Deployment Locally
```bash
# Test Docker build
docker build -t mental-wellness-backend ./backend

# Test environment variables
source .env && echo $MONGODB_URI

# Test health endpoint
curl http://localhost:5000/health
```

---

## Security Best Practices

### 1. Secret Rotation
- Rotate SSH keys every 90 days
- Rotate database passwords every 30 days
- Rotate API keys every 60 days

### 2. Access Control
- Use separate SSH keys for staging and production
- Limit deployment user permissions
- Enable 2FA for GitHub accounts

### 3. Monitoring
- Monitor deployment logs
- Set up alerts for deployment failures
- Track security scan results

### 4. Compliance
- Ensure all secrets are encrypted at rest
- Log all deployment activities
- Regular security audits

---

## Support and Maintenance

### Regular Tasks
- [ ] Weekly: Review deployment logs
- [ ] Monthly: Rotate secrets
- [ ] Quarterly: Security audit
- [ ] Annually: Infrastructure review

### Emergency Procedures
1. **Deployment Rollback**: Use previous Docker image tag
2. **Security Incident**: Rotate all secrets immediately
3. **Service Outage**: Check monitoring dashboards first

### Contact Information
- **DevOps Team**: devops@mental-wellness-ai.com
- **Security Team**: security@mental-wellness-ai.com
- **Emergency**: +1-XXX-XXX-XXXX

---

*Last Updated: September 20, 2025*
*Document Version: 1.0*