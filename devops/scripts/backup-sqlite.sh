#!/bin/sh
# Mental Wellness AI - SQLite Database Backup Script
# HIPAA-compliant automated backup with encryption

set -eu

# Configuration
BACKUP_DIR="/backup"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="mental_wellness_backup_${TIMESTAMP}"
ENCRYPTED_BACKUP="${BACKUP_NAME}.tar.gz.gpg"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
DATABASE_PATH=${DATABASE_PATH:-/app/data/mental_wellness.db}

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

log "Starting backup process for Mental Wellness AI SQLite database"

# Check if database file exists
if [ ! -f "$DATABASE_PATH" ]; then
    error_exit "Database file not found: $DATABASE_PATH"
fi

log "Database file found: $DATABASE_PATH"

# Create backup directory for this backup
BACKUP_WORK_DIR="${BACKUP_DIR}/${BACKUP_NAME}"
mkdir -p "$BACKUP_WORK_DIR"

# Copy SQLite database file
log "Creating SQLite database backup..."
cp "$DATABASE_PATH" "${BACKUP_WORK_DIR}/mental_wellness.db" || error_exit "Failed to copy database file"

# Create metadata file
cat > "${BACKUP_WORK_DIR}/metadata.json" << EOF
{
    "backup_timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "database": "mental_wellness_ai",
    "database_type": "sqlite",
    "backup_type": "full",
    "retention_days": ${RETENTION_DAYS},
    "database_file": "mental_wellness.db",
    "backup_size_bytes": $(stat -c%s "${BACKUP_WORK_DIR}/mental_wellness.db" 2>/dev/null || stat -f%z "${BACKUP_WORK_DIR}/mental_wellness.db"),
    "encrypted": true,
    "compression": "gzip"
}
EOF

# Create database integrity check
log "Creating database integrity check..."
if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "${BACKUP_WORK_DIR}/mental_wellness.db" "PRAGMA integrity_check;" > "${BACKUP_WORK_DIR}/integrity_check.txt" || log "WARNING: Could not run integrity check"
else
    # Install sqlite3 if not available
    if command -v apk >/dev/null 2>&1; then
        apk add --no-cache sqlite || log "WARNING: Could not install sqlite3"
        sqlite3 "${BACKUP_WORK_DIR}/mental_wellness.db" "PRAGMA integrity_check;" > "${BACKUP_WORK_DIR}/integrity_check.txt" || log "WARNING: Could not run integrity check"
    fi
fi

# Compress backup
log "Compressing backup..."
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}/" || error_exit "Compression failed"

# Encrypt backup (HIPAA requirement)
log "Encrypting backup for HIPAA compliance..."
if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    # Install gnupg if not available
    if ! command -v gpg >/dev/null 2>&1; then
        if command -v apk >/dev/null 2>&1; then
            apk add --no-cache gnupg || error_exit "Could not install gnupg"
        else
            error_exit "gpg not available and cannot install"
        fi
    fi
    
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
    if ! command -v aws >/dev/null 2>&1; then
        if command -v apk >/dev/null 2>&1; then
            apk add --no-cache aws-cli || log "WARNING: Could not install aws-cli"
        fi
    fi
    
    if command -v aws >/dev/null 2>&1; then
        # Upload encrypted backup
        aws s3 cp "${ENCRYPTED_BACKUP}" "s3://${S3_BUCKET}/backups/$(date +%Y)/$(date +%m)/" || error_exit "S3 upload failed"
        aws s3 cp "${ENCRYPTED_BACKUP}.sha256" "s3://${S3_BUCKET}/backups/$(date +%Y)/$(date +%m)/" || error_exit "S3 checksum upload failed"
        
        log "Backup successfully uploaded to S3"
    else
        log "WARNING: AWS CLI not available, skipping S3 upload"
    fi
else
    log "Cloud storage not configured, backup stored locally only"
fi

# Clean up temporary files
log "Cleaning up temporary files..."
rm -rf "${BACKUP_WORK_DIR}/"
rm -f "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"

# Cleanup old backups
cleanup_old_backups

# Final verification
BACKUP_SIZE=$(stat -c%s "${BACKUP_DIR}/${ENCRYPTED_BACKUP}" 2>/dev/null || stat -f%z "${BACKUP_DIR}/${ENCRYPTED_BACKUP}")
log "Backup completed successfully"
log "Backup file: ${ENCRYPTED_BACKUP}"
log "Backup size: ${BACKUP_SIZE} bytes"
log "Checksum: $(cat "${ENCRYPTED_BACKUP}.sha256" | cut -d' ' -f1)"

# Send notification if webhook is configured
if [ -n "${BACKUP_WEBHOOK_URL:-}" ]; then
    if command -v curl >/dev/null 2>&1; then
        curl -X POST "${BACKUP_WEBHOOK_URL}" \
             -H "Content-Type: application/json" \
             -d "{
                 \"message\": \"Mental Wellness AI SQLite backup completed successfully\",
                 \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
                 \"backup_file\": \"${ENCRYPTED_BACKUP}\",
                 \"backup_size\": ${BACKUP_SIZE},
                 \"database_type\": \"sqlite\",
                 \"status\": \"success\"
             }" || log "WARNING: Failed to send backup notification"
    else
        log "WARNING: curl not available, skipping notification"
    fi
fi

log "SQLite backup process completed successfully"
exit 0