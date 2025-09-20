#!/bin/bash
# Mental Wellness AI - Backup Restoration Script
# HIPAA-compliant backup restoration with verification

set -euo pipefail

# Configuration
BACKUP_DIR="/backup"
RESTORE_DIR="/restore"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${BACKUP_DIR}/restore.log"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Display usage
usage() {
    echo "Usage: $0 <backup_file> [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -v, --verify-only   Only verify backup integrity, don't restore"
    echo "  -f, --force         Force restoration without confirmation"
    echo "  -d, --dry-run       Show what would be restored without actually doing it"
    echo ""
    echo "Examples:"
    echo "  $0 mental_wellness_backup_20230920_120000.tar.gz.gpg"
    echo "  $0 backup.tar.gz.gpg --verify-only"
    echo "  $0 backup.tar.gz.gpg --dry-run"
    exit 1
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    local backup_path="${BACKUP_DIR}/${backup_file}"
    
    log "Verifying backup integrity for: $backup_file"
    
    # Check if backup file exists
    if [ ! -f "$backup_path" ]; then
        error_exit "Backup file not found: $backup_path"
    fi
    
    # Check if checksum file exists
    local checksum_file="${backup_path}.sha256"
    if [ ! -f "$checksum_file" ]; then
        error_exit "Checksum file not found: $checksum_file"
    fi
    
    # Verify checksum
    log "Verifying backup checksum..."
    cd "$BACKUP_DIR"
    if ! sha256sum -c "${backup_file}.sha256"; then
        error_exit "Backup checksum verification failed"
    fi
    
    log "✓ Backup integrity verified"
    return 0
}

# Decrypt backup
decrypt_backup() {
    local backup_file="$1"
    local backup_path="${BACKUP_DIR}/${backup_file}"
    local decrypted_file="${backup_file%.gpg}"
    
    log "Decrypting backup: $backup_file"
    
    # Check encryption key
    if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
        error_exit "BACKUP_ENCRYPTION_KEY environment variable not set"
    fi
    
    # Decrypt the backup
    cd "$BACKUP_DIR"
    echo "${BACKUP_ENCRYPTION_KEY}" | gpg --batch --yes --passphrase-fd 0 --decrypt "$backup_file" > "$decrypted_file" || error_exit "Failed to decrypt backup"
    
    log "✓ Backup decrypted successfully"
    echo "$decrypted_file"
}

# Extract backup
extract_backup() {
    local compressed_file="$1"
    local extract_path="$2"
    
    log "Extracting backup: $compressed_file"
    
    # Create extraction directory
    mkdir -p "$extract_path"
    
    # Extract the compressed backup
    cd "$BACKUP_DIR"
    tar -xzf "$compressed_file" -C "$extract_path" || error_exit "Failed to extract backup"
    
    log "✓ Backup extracted to: $extract_path"
}

# Verify MongoDB connection
verify_mongo_connection() {
    log "Verifying MongoDB connection..."
    
    if [ -z "${MONGO_URI:-}" ]; then
        error_exit "MONGO_URI environment variable not set"
    fi
    
    mongosh "${MONGO_URI}" --eval "db.adminCommand('ping')" > /dev/null || error_exit "Cannot connect to MongoDB"
    
    log "✓ MongoDB connection verified"
}

# Create database backup before restoration
create_pre_restore_backup() {
    log "Creating pre-restoration backup..."
    
    local pre_restore_backup="pre_restore_backup_${TIMESTAMP}"
    mongodump --uri="${MONGO_URI}" --out="${BACKUP_DIR}/${pre_restore_backup}" || error_exit "Failed to create pre-restoration backup"
    
    # Compress the pre-restoration backup
    cd "$BACKUP_DIR"
    tar -czf "${pre_restore_backup}.tar.gz" "${pre_restore_backup}/" || error_exit "Failed to compress pre-restoration backup"
    
    # Clean up uncompressed backup
    rm -rf "${pre_restore_backup}/"
    
    log "✓ Pre-restoration backup created: ${pre_restore_backup}.tar.gz"
}

# Restore database from backup
restore_database() {
    local backup_extract_path="$1"
    local backup_name="$2"
    
    log "Starting database restoration from: $backup_extract_path"
    
    # Find the database dump directory
    local dump_dir
    if [ -d "${backup_extract_path}/${backup_name}/mental_wellness_ai" ]; then
        dump_dir="${backup_extract_path}/${backup_name}/mental_wellness_ai"
    elif [ -d "${backup_extract_path}/mental_wellness_ai" ]; then
        dump_dir="${backup_extract_path}/mental_wellness_ai"
    else
        error_exit "Could not find database dump in backup"
    fi
    
    log "Restoring from dump directory: $dump_dir"
    
    # Drop existing database (with confirmation)
    if [ "${FORCE_RESTORE:-false}" != "true" ]; then
        read -p "This will replace the existing database. Continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "Restoration cancelled by user"
            exit 0
        fi
    fi
    
    # Restore the database
    mongorestore --uri="${MONGO_URI}" --drop --dir="$dump_dir" || error_exit "Database restoration failed"
    
    log "✓ Database restoration completed"
}

# Verify restored data
verify_restored_data() {
    log "Verifying restored data..."
    
    # Check if database exists and has data
    local doc_count
    doc_count=$(mongosh "${MONGO_URI}" --eval "db.users.countDocuments()" --quiet) || error_exit "Failed to verify restored data"
    
    if [ "$doc_count" -gt 0 ]; then
        log "✓ Database verification passed: $doc_count documents found"
    else
        log "WARNING: No documents found in users collection"
    fi
    
    # Check metadata file if available
    local metadata_file="${RESTORE_DIR}/metadata.json"
    if [ -f "$metadata_file" ]; then
        log "Backup metadata:"
        cat "$metadata_file" | while IFS= read -r line; do
            log "  $line"
        done
    fi
}

# Cleanup temporary files
cleanup_temp_files() {
    log "Cleaning up temporary files..."
    
    # Remove decrypted files
    find "$BACKUP_DIR" -name "*.tar.gz" -not -name "*.gpg" -delete 2>/dev/null || true
    
    # Remove extraction directory
    [ -d "$RESTORE_DIR" ] && rm -rf "$RESTORE_DIR"
    
    log "✓ Cleanup completed"
}

# Main restoration function
main() {
    local backup_file=""
    local verify_only=false
    local dry_run=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                ;;
            -v|--verify-only)
                verify_only=true
                shift
                ;;
            -f|--force)
                FORCE_RESTORE=true
                shift
                ;;
            -d|--dry-run)
                dry_run=true
                shift
                ;;
            -*)
                echo "Unknown option $1"
                usage
                ;;
            *)
                backup_file="$1"
                shift
                ;;
        esac
    done
    
    # Check if backup file was provided
    if [ -z "$backup_file" ]; then
        echo "Error: Backup file not specified"
        usage
    fi
    
    log "Starting backup restoration process"
    log "Backup file: $backup_file"
    log "Verify only: $verify_only"
    log "Dry run: $dry_run"
    
    # Create restore directory
    mkdir -p "$RESTORE_DIR"
    
    # Step 1: Verify backup integrity
    verify_backup "$backup_file"
    
    if [ "$verify_only" = true ]; then
        log "Backup verification completed successfully"
        exit 0
    fi
    
    # Step 2: Verify MongoDB connection
    verify_mongo_connection
    
    if [ "$dry_run" = true ]; then
        log "DRY RUN: Would restore backup $backup_file"
        log "DRY RUN: Would create pre-restoration backup"
        log "DRY RUN: Would decrypt and extract backup"
        log "DRY RUN: Would restore database"
        log "DRY RUN: Would verify restored data"
        exit 0
    fi
    
    # Step 3: Create pre-restoration backup
    create_pre_restore_backup
    
    # Step 4: Decrypt backup
    local decrypted_file
    decrypted_file=$(decrypt_backup "$backup_file")
    
    # Step 5: Extract backup
    local backup_name="${decrypted_file%.tar.gz}"
    extract_backup "$decrypted_file" "$RESTORE_DIR"
    
    # Step 6: Restore database
    restore_database "$RESTORE_DIR" "$backup_name"
    
    # Step 7: Verify restored data
    verify_restored_data
    
    # Step 8: Cleanup
    cleanup_temp_files
    
    log "Backup restoration completed successfully"
    log "Original data backed up as: pre_restore_backup_${TIMESTAMP}.tar.gz"
    
    # Send notification if webhook is configured
    if [ -n "${BACKUP_WEBHOOK_URL:-}" ]; then
        curl -X POST "${BACKUP_WEBHOOK_URL}" \
             -H "Content-Type: application/json" \
             -d "{
                 \"message\": \"Mental Wellness AI database restoration completed\",
                 \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
                 \"backup_file\": \"$backup_file\",
                 \"status\": \"success\"
             }" || log "WARNING: Failed to send restoration notification"
    fi
}

# Set up signal handlers for cleanup
trap cleanup_temp_files EXIT

# Run main function with all arguments
main "$@"