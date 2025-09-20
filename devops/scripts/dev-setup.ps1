# Mental Wellness AI - Development Environment Setup Script (PowerShell)
# Quick setup for local development on Windows

param(
    [Parameter(Position=0)]
    [string]$Action = "help",
    
    [Parameter(Position=1)]
    [string]$Service = ""
)

# Color functions for output
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if Docker is installed and running
function Test-Docker {
    Write-Info "Checking Docker installation..."
    
    try {
        $dockerVersion = docker --version
        if (-not $?) {
            Write-Error "Docker is not installed. Please install Docker Desktop first."
            exit 1
        }
        
        $dockerInfo = docker info 2>$null
        if (-not $?) {
            Write-Error "Docker is not running. Please start Docker Desktop first."
            exit 1
        }
        
        Write-Success "Docker is installed and running"
    }
    catch {
        Write-Error "Docker check failed: $($_.Exception.Message)"
        exit 1
    }
}

# Check if Docker Compose is available
function Test-DockerCompose {
    Write-Info "Checking Docker Compose..."
    
    try {
        $composeVersion = docker-compose --version 2>$null
        if (-not $?) {
            $composeVersion = docker compose version 2>$null
            if (-not $?) {
                Write-Error "Docker Compose is not available. Please install Docker Compose."
                exit 1
            }
        }
        
        Write-Success "Docker Compose is available"
    }
    catch {
        Write-Error "Docker Compose check failed: $($_.Exception.Message)"
        exit 1
    }
}

# Create environment file from template
function Initialize-Environment {
    Write-Info "Setting up environment files..."
    
    $envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
    $envExample = Join-Path (Split-Path $PSScriptRoot -Parent) ".env.example"
    
    if (Test-Path $envFile) {
        Write-Warning "Environment file already exists. Backing up existing file..."
        $backupName = ".env.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Copy-Item $envFile (Join-Path (Split-Path $envFile -Parent) $backupName)
    }
    
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Success "Environment file created from template"
    }
    else {
        Write-Warning "No .env.example found. Creating basic environment file..."
        New-BasicEnvFile $envFile
    }
    
    Write-Warning "Please edit $envFile with your actual values before starting services"
}

# Create a basic environment file if no template exists
function New-BasicEnvFile {
    param([string]$EnvFile)
    
    $envContent = @'
# Mental Wellness AI - Environment Configuration
# Development Environment

# Node.js Environment
NODE_ENV=development

# Database Configuration
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=changeme123
MONGODB_URI=mongodb://admin:changeme123@mongodb:27017/mental_wellness_ai?authSource=admin

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
'@
    
    Set-Content -Path $EnvFile -Value $envContent
    Write-Success "Basic environment file created"
}

# Validate environment variables
function Test-Environment {
    Write-Info "Validating environment configuration..."
    
    $envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
    
    if (-not (Test-Path $envFile)) {
        Write-Error "Environment file not found. Run setup first."
        return $false
    }
    
    # Read environment file
    $envVars = @{}
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $envVars[$matches[1]] = $matches[2]
        }
    }
    
    # Check critical variables
    $errors = 0
    
    if (-not $envVars.ContainsKey("REDIS_PASSWORD") -or $envVars["REDIS_PASSWORD"] -eq "redis123") {
        Write-Warning "REDIS_PASSWORD should be changed from default"
        $errors++
    }
    
    if (-not $envVars.ContainsKey("JWT_SECRET") -or $envVars["JWT_SECRET"] -eq "your-super-secret-jwt-key-change-in-production") {
        Write-Warning "JWT_SECRET should be set to a secure value"
        $errors++
    }
    
    if (-not $envVars.ContainsKey("DATABASE_PATH")) {
        Write-Warning "DATABASE_PATH should be set for SQLite database location"
        $errors++
    }
    
    if (-not $envVars.ContainsKey("OPENAI_API_KEY") -or $envVars["OPENAI_API_KEY"] -eq "your-openai-api-key-here") {
        Write-Warning "OPENAI_API_KEY needs to be set with your actual API key"
        $errors++
    }
    
    if (-not $envVars.ContainsKey("GEMINI_API_KEY") -or $envVars["GEMINI_API_KEY"] -eq "your-gemini-api-key-here") {
        Write-Warning "GEMINI_API_KEY needs to be set with your actual API key"
        $errors++
    }
    
    if ($errors -gt 0) {
        Write-Warning "$errors environment variables need attention"
        Write-Info "Edit $envFile to fix these issues"
    }
    else {
        Write-Success "Environment validation passed"
    }
    
    return $true
}

# Build Docker images
function Build-Images {
    Write-Info "Building Docker images..."
    
    $projectRoot = Split-Path $PSScriptRoot -Parent
    Set-Location $projectRoot
    
    # Build backend image
    Write-Info "Building backend image..."
    docker build -t mental-wellness-backend ./backend
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build backend image"
        exit 1
    }
    
    Write-Success "Docker images built successfully"
}

# Start all services
function Start-Services {
    Write-Info "Starting all services..."
    
    $projectRoot = Split-Path $PSScriptRoot -Parent
    Set-Location $projectRoot
    
    # Start services in background
    docker-compose up -d
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start services"
        exit 1
    }
    
    Write-Info "Waiting for services to start..."
    Start-Sleep -Seconds 10
    
    # Check service health
    Test-ServiceHealth
}

# Check health of all services
function Test-ServiceHealth {
    Write-Info "Checking service health..."
    
    $services = @("redis", "backend", "nginx", "prometheus", "grafana")
    $healthy = 0
    
    foreach ($service in $services) {
        $status = docker-compose ps $service | Select-String "Up"
        if ($status) {
            Write-Success "$service is running"
            $healthy++
        }
        else {
            Write-Error "$service is not running"
        }
    }
    
    Write-Info "$healthy/$($services.Count) services are healthy"
    
    # Test API health endpoint
    Write-Info "Testing API health endpoint..."
    Start-Sleep -Seconds 5
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Success "Backend API is responding"
        }
        else {
            Write-Warning "Backend API returned status code: $($response.StatusCode)"
        }
    }
    catch {
        Write-Warning "Backend API health check failed: $($_.Exception.Message)"
    }
}

# Stop all services
function Stop-Services {
    Write-Info "Stopping all services..."
    
    $projectRoot = Split-Path $PSScriptRoot -Parent
    Set-Location $projectRoot
    
    docker-compose down
    
    Write-Success "All services stopped"
}

# Clean up development environment
function Remove-Environment {
    Write-Info "Cleaning up development environment..."
    
    $projectRoot = Split-Path $PSScriptRoot -Parent
    Set-Location $projectRoot
    
    # Stop and remove containers
    docker-compose down --volumes --remove-orphans
    
    # Remove built images
    docker rmi mental-wellness-backend 2>$null
    
    # Clean up unused Docker resources
    docker system prune -f
    
    Write-Success "Cleanup completed"
}

# Show service logs
function Show-Logs {
    param([string]$ServiceName)
    
    $projectRoot = Split-Path $PSScriptRoot -Parent
    Set-Location $projectRoot
    
    if ($ServiceName) {
        Write-Info "Showing logs for $ServiceName..."
        docker-compose logs -f $ServiceName
    }
    else {
        Write-Info "Showing logs for all services..."
        docker-compose logs -f
    }
}

# Show service status
function Show-Status {
    Write-Info "Service Status:"
    Write-Host "=================="
    
    $projectRoot = Split-Path $PSScriptRoot -Parent
    Set-Location $projectRoot
    
    docker-compose ps
    
    Write-Host ""
    Write-Info "Service URLs:"
    Write-Host "=================="
    Write-Host "Backend API:    http://localhost:5000"
    Write-Host "API Health:     http://localhost:5000/health"
    Write-Host "Nginx:          http://localhost:80"
    Write-Host "Grafana:        http://localhost:3001 (admin/admin)"
    Write-Host "Prometheus:     http://localhost:9090"
}

# Main script execution
switch ($Action.ToLower()) {
    "setup" {
        Write-Info "Setting up Mental Wellness AI development environment..."
        Test-Docker
        Test-DockerCompose
        Initialize-Environment
        Test-Environment
        Build-Images
        Write-Success "Setup completed! Run '.\dev-setup.ps1 start' to start services"
    }
    "start" {
        Test-Docker
        Test-DockerCompose
        Test-Environment
        Start-Services
        Show-Status
    }
    "stop" {
        Stop-Services
    }
    "restart" {
        Stop-Services
        Start-Services
        Show-Status
    }
    "status" {
        Show-Status
    }
    "logs" {
        Show-Logs $Service
    }
    "build" {
        Build-Images
    }
    "cleanup" {
        Remove-Environment
    }
    "validate" {
        Test-Environment
    }
    default {
        Write-Host "Mental Wellness AI - Development Environment Manager" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Usage: .\dev-setup.ps1 <command> [options]"
        Write-Host ""
        Write-Host "Commands:"
        Write-Host "  setup      - Initial setup of development environment"
        Write-Host "  start      - Start all services"
        Write-Host "  stop       - Stop all services"
        Write-Host "  restart    - Restart all services"
        Write-Host "  status     - Show service status and URLs"
        Write-Host "  logs       - Show logs for all services or specific service"
        Write-Host "  build      - Build Docker images"
        Write-Host "  cleanup    - Clean up containers, volumes, and images"
        Write-Host "  validate   - Validate environment configuration"
        Write-Host "  help       - Show this help message"
        Write-Host ""
        Write-Host "Examples:"
        Write-Host "  .\dev-setup.ps1 setup              # Initial setup"
        Write-Host "  .\dev-setup.ps1 start              # Start all services"
        Write-Host "  .\dev-setup.ps1 logs backend       # Show backend logs"
        Write-Host "  .\dev-setup.ps1 status             # Show service status"
    }
}