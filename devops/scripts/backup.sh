#!/bin/bash
# Mental Wellness AI - Database Backup Script
# HIPAA-compliant automated backup with encryption

set -euo pipefail

# Configuration
BACKUP_DIR="/backup"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="mental_wellness_backup_${TIMESTAMP}"
ENCRYPTED_BACKUP="${BACKUP_NAME}.tar.gz.gpg"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${BACKUP_DIR}/backup.log"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up backups older than ${RETENTION_DAYS} days"
    find "${BACKUP_DIR}" -name "mental_wellness_backup_*.tar.gz.gpg" -mtime +${RETENTION_DAYS} -delete || true
    find "${BACKUP_DIR}" -name "backup_*.log" -mtime +${RETENTION_DAYS} -delete || true
}

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

log "Starting backup process for Mental Wellness AI database"

# Verify MongoDB connection
log "Verifying MongoDB connection..."
mongosh "${MONGO_URI}" --eval "db.adminCommand('ping')" > /dev/null || error_exit "Cannot connect to MongoDB"

# Create database backup
log "Creating MongoDB dump..."
mongodump --uri="${MONGO_URI}" --out="${BACKUP_DIR}/${BACKUP_NAME}" || error_exit "MongoDB dump failed"

# Create metadata file
cat > "${BACKUP_DIR}/${BACKUP_NAME}/metadata.json" << EOF
{
    "backup_timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "database": "mental_wellness_ai",
    "backup_type": "full",
    "retention_days": ${RETENTION_DAYS},
    "mongodb_version": "$(mongosh --version | head -1)",
    "backup_size_bytes": $(du -sb "${BACKUP_DIR}/${BACKUP_NAME}" | cut -f1),
    "encrypted": true,
    "compression": "gzip"
}
EOF

# Compress backup
log "Compressing backup..."
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}/" || error_exit "Compression failed"

# Encrypt backup (HIPAA requirement)
log "Encrypting backup for HIPAA compliance..."
if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    echo "${BACKUP_ENCRYPTION_KEY}" | gpg --batch --yes --passphrase-fd 0 --symmetric --cipher-algo AES256 --compress-algo 2 --output "${ENCRYPTED_BACKUP}" "${BACKUP_NAME}.tar.gz" || error_exit "Encryption failed"
else
    error_exit "BACKUP_ENCRYPTION_KEY environment variable not set"
fi

# Calculate checksums
log "Calculating checksums..."
sha256sum "${ENCRYPTED_BACKUP}" > "${ENCRYPTED_BACKUP}.sha256"

# Verify backup integrity
log "Verifying backup integrity..."
sha256sum -c "${ENCRYPTED_BACKUP}.sha256" || error_exit "Backup integrity check failed"

# Upload to cloud storage if configured
if [ -n "${AWS_ACCESS_KEY_ID:-}" ] && [ -n "${AWS_SECRET_ACCESS_KEY:-}" ] && [ -n "${S3_BUCKET:-}" ]; then
    log "Uploading backup to S3..."
    
    # Install AWS CLI if not present
    if ! command -v aws &> /dev/null; then
        apt-get update && apt-get install -y awscli
    fi
    
    # Upload encrypted backup
    aws s3 cp "${ENCRYPTED_BACKUP}" "s3://${S3_BUCKET}/backups/$(date +%Y)/$(date +%m)/" || error_exit "S3 upload failed"
    aws s3 cp "${ENCRYPTED_BACKUP}.sha256" "s3://${S3_BUCKET}/backups/$(date +%Y)/$(date +%m)/" || error_exit "S3 checksum upload failed"
    
    log "Backup successfully uploaded to S3"
else
    log "Cloud storage not configured, backup stored locally only"
fi

# Clean up temporary files
log "Cleaning up temporary files..."
rm -rf "${BACKUP_DIR}/${BACKUP_NAME}/"
rm -f "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"

# Cleanup old backups
cleanup_old_backups

# Final verification
BACKUP_SIZE=$(stat -f%z "${BACKUP_DIR}/${ENCRYPTED_BACKUP}" 2>/dev/null || stat -c%s "${BACKUP_DIR}/${ENCRYPTED_BACKUP}")
log "Backup completed successfully"
log "Backup file: ${ENCRYPTED_BACKUP}"
log "Backup size: ${BACKUP_SIZE} bytes"
log "Checksum: $(cat "${ENCRYPTED_BACKUP}.sha256" | cut -d' ' -f1)"

# Send notification if webhook is configured
if [ -n "${BACKUP_WEBHOOK_URL:-}" ]; then
    curl -X POST "${BACKUP_WEBHOOK_URL}" \
         -H "Content-Type: application/json" \
         -d "{
             \"message\": \"Mental Wellness AI backup completed successfully\",
             \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
             \"backup_file\": \"${ENCRYPTED_BACKUP}\",
             \"backup_size\": ${BACKUP_SIZE},
             \"status\": \"success\"
         }" || log "WARNING: Failed to send backup notification"
fi

log "Backup process completed successfully"
exit 0