#!/bin/sh
# Mental Wellness AI - SQLite Backup Restoration Script
# HIPAA-compliant backup restoration with verification

set -eu

# Configuration
BACKUP_DIR="/backup"
RESTORE_DIR="/restore"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATABASE_PATH=${DATABASE_PATH:-/app/data/mental_wellness.db}

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
    
    # Install gnupg if not available
    if ! command -v gpg >/dev/null 2>&1; then
        if command -v apk >/dev/null 2>&1; then
            apk add --no-cache gnupg || error_exit "Could not install gnupg"
        else
            error_exit "gpg not available and cannot install"
        fi
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

# Verify database file integrity
verify_database_integrity() {
    local db_file="$1"
    
    log "Verifying SQLite database integrity..."
    
    # Install sqlite3 if not available
    if ! command -v sqlite3 >/dev/null 2>&1; then
        if command -v apk >/dev/null 2>&1; then
            apk add --no-cache sqlite || error_exit "Could not install sqlite3"
        else
            error_exit "sqlite3 not available and cannot install"
        fi
    fi
    
    # Check database integrity
    local integrity_result
    integrity_result=$(sqlite3 "$db_file" "PRAGMA integrity_check;" 2>/dev/null || echo "error")
    
    if [ "$integrity_result" = "ok" ]; then
        log "✓ Database integrity check passed"
    else
        error_exit "Database integrity check failed: $integrity_result"
    fi
}

# Create database backup before restoration
create_pre_restore_backup() {
    log "Creating pre-restoration backup..."
    
    if [ -f "$DATABASE_PATH" ]; then
        local pre_restore_backup="${BACKUP_DIR}/pre_restore_backup_${TIMESTAMP}.db"
        cp "$DATABASE_PATH" "$pre_restore_backup" || error_exit "Failed to create pre-restoration backup"
        
        # Compress the pre-restoration backup
        gzip "$pre_restore_backup" || error_exit "Failed to compress pre-restoration backup"
        
        log "✓ Pre-restoration backup created: pre_restore_backup_${TIMESTAMP}.db.gz"
    else
        log "No existing database found, skipping pre-restoration backup"
    fi
}

# Restore database from backup
restore_database() {
    local backup_extract_path="$1"
    local backup_name="$2"
    
    log "Starting database restoration from: $backup_extract_path"
    
    # Find the database file
    local source_db_file
    if [ -f "${backup_extract_path}/${backup_name}/mental_wellness.db" ]; then
        source_db_file="${backup_extract_path}/${backup_name}/mental_wellness.db"
    elif [ -f "${backup_extract_path}/mental_wellness.db" ]; then
        source_db_file="${backup_extract_path}/mental_wellness.db"
    else
        error_exit "Could not find database file in backup"
    fi
    
    log "Restoring from database file: $source_db_file"
    
    # Verify source database integrity
    verify_database_integrity "$source_db_file"
    
    # Confirm restoration (unless forced)
    if [ "${FORCE_RESTORE:-false}" != "true" ]; then
        printf "This will replace the existing database. Continue? (y/N): "
        read -r response
        case "$response" in
            [yY]|[yY][eE][sS])
                ;;
            *)
                log "Restoration cancelled by user"
                exit 0
                ;;
        esac
    fi
    
    # Create database directory if it doesn't exist
    mkdir -p "$(dirname "$DATABASE_PATH")"
    
    # Restore the database
    cp "$source_db_file" "$DATABASE_PATH" || error_exit "Database restoration failed"
    
    log "✓ Database restoration completed"
}

# Verify restored data
verify_restored_data() {
    log "Verifying restored data..."
    
    # Check if database file exists and is valid
    if [ ! -f "$DATABASE_PATH" ]; then
        error_exit "Restored database file not found"
    fi
    
    # Verify database integrity
    verify_database_integrity "$DATABASE_PATH"
    
    # Get basic table count information
    if command -v sqlite3 >/dev/null 2>&1; then
        local table_count
        table_count=$(sqlite3 "$DATABASE_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "0")
        
        if [ "$table_count" -gt 0 ]; then
            log "✓ Database verification passed: $table_count tables found"
        else
            log "WARNING: No tables found in restored database"
        fi
    fi
    
    # Check metadata file if available
    local metadata_file="${RESTORE_DIR}/metadata.json"
    if [ -f "$metadata_file" ]; then
        log "Backup metadata:"
        while IFS= read -r line; do
            log "  $line"
        done < "$metadata_file"
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
    while [ $# -gt 0 ]; do
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
    
    log "Starting SQLite backup restoration process"
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
    
    if [ "$dry_run" = true ]; then
        log "DRY RUN: Would restore backup $backup_file"
        log "DRY RUN: Would create pre-restoration backup"
        log "DRY RUN: Would decrypt and extract backup"
        log "DRY RUN: Would restore database to $DATABASE_PATH"
        log "DRY RUN: Would verify restored data"
        exit 0
    fi
    
    # Step 2: Create pre-restoration backup
    create_pre_restore_backup
    
    # Step 3: Decrypt backup
    local decrypted_file
    decrypted_file=$(decrypt_backup "$backup_file")
    
    # Step 4: Extract backup
    local backup_name="${decrypted_file%.tar.gz}"
    extract_backup "$decrypted_file" "$RESTORE_DIR"
    
    # Step 5: Restore database
    restore_database "$RESTORE_DIR" "$backup_name"
    
    # Step 6: Verify restored data
    verify_restored_data
    
    # Step 7: Cleanup
    cleanup_temp_files
    
    log "SQLite backup restoration completed successfully"
    log "Original data backed up as: pre_restore_backup_${TIMESTAMP}.db.gz"
    
    # Send notification if webhook is configured
    if [ -n "${BACKUP_WEBHOOK_URL:-}" ] && command -v curl >/dev/null 2>&1; then
        curl -X POST "${BACKUP_WEBHOOK_URL}" \
             -H "Content-Type: application/json" \
             -d "{
                 \"message\": \"Mental Wellness AI SQLite database restoration completed\",
                 \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
                 \"backup_file\": \"$backup_file\",
                 \"database_type\": \"sqlite\",
                 \"status\": \"success\"
             }" || log "WARNING: Failed to send restoration notification"
    fi
}

# Set up signal handlers for cleanup
trap cleanup_temp_files EXIT

# Run main function with all arguments
main "$@"