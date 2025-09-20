#!/bin/bash
# Mental Wellness AI - Development Environment Setup Script
# Quick setup for local development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed and running
check_docker() {
    log_info "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    log_success "Docker is installed and running"
}

# Check if Docker Compose is available
check_docker_compose() {
    log_info "Checking Docker Compose..."
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
    
    log_success "Docker Compose is available"
}

# Create environment file from template
setup_environment() {
    log_info "Setting up environment files..."
    
    ENV_FILE="$(dirname "$0")/../.env"
    ENV_EXAMPLE="$(dirname "$0")/../.env.example"
    
    if [ -f "$ENV_FILE" ]; then
        log_warning "Environment file already exists. Backing up existing file..."
        cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    if [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        log_success "Environment file created from template"
    else
        log_warning "No .env.example found. Creating basic environment file..."
        create_basic_env_file "$ENV_FILE"
    fi
    
    log_warning "Please edit $ENV_FILE with your actual values before starting services"
}

# Create a basic environment file if no template exists
create_basic_env_file() {
    local env_file="$1"
    
    cat > "$env_file" << 'EOF'
# Mental Wellness AI - Environment Configuration
# Development Environment

# Node.js Environment
NODE_ENV=development

# Database Configuration
DATABASE_PATH=/app/data/mental_wellness.db

# Redis Configuration
REDIS_PASSWORD=redis123

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# AI Service API Keys (Add your actual keys)
OPENAI_API_KEY=your-openai-api-key-here
GEMINI_API_KEY=your-gemini-api-key-here

# Firebase Configuration (Add your actual values)
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-firebase-client-email
FIREBASE_PRIVATE_KEY=your-firebase-private-key

# Frontend Configuration
FRONTEND_URL=http://localhost:3000
MOBILE_APP_URL=http://localhost:19006

# Monitoring Configuration
GRAFANA_ADMIN_PASSWORD=admin
GRAFANA_ROOT_URL=http://localhost:3001

# Logging Configuration
LOG_LEVEL=debug
SENTRY_DSN=your-sentry-dsn-here

# HIPAA Compliance
HIPAA_ENCRYPTION_KEY=your-hipaa-encryption-key-32-chars

# Backup Configuration
BACKUP_RETENTION_DAYS=30
BACKUP_ENCRYPTION_KEY=your-backup-encryption-key

# AWS Configuration (Optional - for cloud backups)
# AWS_ACCESS_KEY_ID=your-aws-access-key
# AWS_SECRET_ACCESS_KEY=your-aws-secret-key
# S3_BACKUP_BUCKET=your-backup-bucket

# Notification Configuration (Optional)
# SLACK_WEBHOOK_URL=your-slack-webhook-url
# BACKUP_WEBHOOK_URL=your-backup-notification-url
EOF
    
    log_success "Basic environment file created"
}

# Validate environment variables
validate_environment() {
    log_info "Validating environment configuration..."
    
    ENV_FILE="$(dirname "$0")/../.env"
    
    if [ ! -f "$ENV_FILE" ]; then
        log_error "Environment file not found. Run setup first."
        return 1
    fi
    
    # Source the environment file
    set -a
    source "$ENV_FILE"
    set +a
    
    # Check critical variables
    local errors=0
    
    if [ -z "${REDIS_PASSWORD:-}" ] || [ "$REDIS_PASSWORD" = "redis123" ]; then
        log_warning "REDIS_PASSWORD should be changed from default"
        ((errors++))
    fi
    
    if [ -z "${DATABASE_PATH:-}" ]; then
        log_warning "DATABASE_PATH should be set for SQLite database location"
        ((errors++))
    fi
    
    if [ -z "${JWT_SECRET:-}" ] || [ "$JWT_SECRET" = "your-super-secret-jwt-key-change-in-production" ]; then
        log_warning "JWT_SECRET should be set to a secure value"
        ((errors++))
    fi
    
    if [ -z "${OPENAI_API_KEY:-}" ] || [ "$OPENAI_API_KEY" = "your-openai-api-key-here" ]; then
        log_warning "OPENAI_API_KEY needs to be set with your actual API key"
        ((errors++))
    fi
    
    if [ -z "${GEMINI_API_KEY:-}" ] || [ "$GEMINI_API_KEY" = "your-gemini-api-key-here" ]; then
        log_warning "GEMINI_API_KEY needs to be set with your actual API key"
        ((errors++))
    fi
    
    if [ $errors -gt 0 ]; then
        log_warning "$errors environment variables need attention"
        log_info "Edit $ENV_FILE to fix these issues"
    else
        log_success "Environment validation passed"
    fi
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."
    
    cd "$(dirname "$0")/.."
    
    # Build backend image
    log_info "Building backend image..."
    docker build -t mental-wellness-backend ./backend
    
    log_success "Docker images built successfully"
}

# Start all services
start_services() {
    log_info "Starting all services..."
    
    cd "$(dirname "$0")/.."
    
    # Start services in background
    docker-compose up -d
    
    log_info "Waiting for services to start..."
    sleep 10
    
    # Check service health
    check_service_health
}

# Check health of all services
check_service_health() {
    log_info "Checking service health..."
    
    local services=("redis" "backend" "nginx" "prometheus" "grafana")
    local healthy=0
    local total=${#services[@]}
    
    for service in "${services[@]}"; do
        if docker-compose ps "$service" | grep -q "Up"; then
            log_success "$service is running"
            ((healthy++))
        else
            log_error "$service is not running"
        fi
    done
    
    log_info "$healthy/$total services are healthy"
    
    # Test API health endpoint
    log_info "Testing API health endpoint..."
    sleep 5  # Give services more time to fully start
    
    if curl -f http://localhost:5000/health &> /dev/null; then
        log_success "Backend API is responding"
    else
        log_warning "Backend API health check failed"
    fi
}

# Stop all services
stop_services() {
    log_info "Stopping all services..."
    
    cd "$(dirname "$0")/.."
    docker-compose down
    
    log_success "All services stopped"
}

# Clean up development environment
cleanup() {
    log_info "Cleaning up development environment..."
    
    cd "$(dirname "$0")/.."
    
    # Stop and remove containers
    docker-compose down --volumes --remove-orphans
    
    # Remove built images
    docker rmi mental-wellness-backend 2>/dev/null || true
    
    # Clean up unused Docker resources
    docker system prune -f
    
    log_success "Cleanup completed"
}

# Show service logs
show_logs() {
    local service="${1:-}"
    
    cd "$(dirname "$0")/.."
    
    if [ -n "$service" ]; then
        log_info "Showing logs for $service..."
        docker-compose logs -f "$service"
    else
        log_info "Showing logs for all services..."
        docker-compose logs -f
    fi
}

# Show service status
show_status() {
    log_info "Service Status:"
    echo "=================="
    
    cd "$(dirname "$0")/.."
    docker-compose ps
    
    echo ""
    log_info "Service URLs:"
    echo "=================="
    echo "Backend API:    http://localhost:5000"
    echo "API Health:     http://localhost:5000/health"
    echo "Nginx:          http://localhost:80"
    echo "Grafana:        http://localhost:3001 (admin/admin)"
    echo "Prometheus:     http://localhost:9090"
}

# Main function
main() {
    local action="${1:-help}"
    
    case "$action" in
        "setup")
            log_info "Setting up Mental Wellness AI development environment..."
            check_docker
            check_docker_compose
            setup_environment
            validate_environment
            build_images
            log_success "Setup completed! Run './dev-setup.sh start' to start services"
            ;;
        "start")
            check_docker
            check_docker_compose
            validate_environment
            start_services
            show_status
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            stop_services
            start_services
            show_status
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs "${2:-}"
            ;;
        "build")
            build_images
            ;;
        "cleanup")
            cleanup
            ;;
        "validate")
            validate_environment
            ;;
        "help"|*)
            echo "Mental Wellness AI - Development Environment Manager"
            echo ""
            echo "Usage: $0 <command> [options]"
            echo ""
            echo "Commands:"
            echo "  setup      - Initial setup of development environment"
            echo "  start      - Start all services"
            echo "  stop       - Stop all services"
            echo "  restart    - Restart all services"
            echo "  status     - Show service status and URLs"
            echo "  logs       - Show logs for all services or specific service"
            echo "  build      - Build Docker images"
            echo "  cleanup    - Clean up containers, volumes, and images"
            echo "  validate   - Validate environment configuration"
            echo "  help       - Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 setup              # Initial setup"
            echo "  $0 start              # Start all services"
            echo "  $0 logs backend       # Show backend logs"
            echo "  $0 status             # Show service status"
            ;;
    esac
}

# Run main function with all arguments
main "$@"