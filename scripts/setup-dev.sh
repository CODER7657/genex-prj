#!/bin/bash

# Development Setup Script
# Automated setup for Mental Wellness AI development environment

set -e

echo "🚀 Setting up Mental Wellness AI Development Environment..."

# Check prerequisites
check_prerequisites() {
    echo "📋 Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed. Please install Docker and try again."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        echo "❌ Docker Compose is not installed. Please install Docker Compose and try again."
        exit 1
    fi
    
    echo "✅ Prerequisites check passed!"
}

# Setup environment files
setup_environment() {
    echo "🔧 Setting up environment files..."
    
    # Backend environment
    if [ ! -f "backend/.env" ]; then
        cp .env.example backend/.env
        echo "📁 Created backend/.env from template"
    fi
    
    # Frontend environment
    if [ ! -f "frontend/.env" ]; then
        cat > frontend/.env << EOF
EXPO_PUBLIC_API_URL=http://localhost:5000/api
EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-oauth-client-id
EOF
        echo "📁 Created frontend/.env from template"
    fi
    
    echo "✅ Environment files configured!"
}

# Install backend dependencies
setup_backend() {
    echo "🏗️  Setting up backend..."
    
    cd backend
    
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing backend dependencies..."
        npm install
    else
        echo "📦 Backend dependencies already installed"
    fi
    
    echo "✅ Backend setup complete!"
    cd ..
}

# Install frontend dependencies
setup_frontend() {
    echo "📱 Setting up frontend..."
    
    cd frontend
    
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing frontend dependencies..."
        npm install
    else
        echo "📦 Frontend dependencies already installed"
    fi
    
    echo "✅ Frontend setup complete!"
    cd ..
}

# Setup database services
setup_services() {
    echo "🗄️  Setting up database services..."
    
    cd devops
    
    # Start MongoDB and Redis
    docker-compose up -d mongodb redis
    
    echo "⏳ Waiting for services to be ready..."
    sleep 10
    
    # Check if services are running
    if docker-compose ps | grep -q "Up"; then
        echo "✅ Database services are running!"
    else
        echo "❌ Failed to start database services"
        exit 1
    fi
    
    cd ..
}

# Create necessary directories
create_directories() {
    echo "📁 Creating necessary directories..."
    
    # Backend directories
    mkdir -p backend/logs
    mkdir -p backend/uploads
    mkdir -p backend/temp
    
    # Frontend directories
    mkdir -p frontend/assets/images
    mkdir -p frontend/assets/fonts
    
    # Test directories
    mkdir -p tests/reports
    mkdir -p tests/screenshots
    
    echo "✅ Directories created!"
}

# Generate development certificates
generate_certificates() {
    echo "🔐 Generating development certificates..."
    
    mkdir -p devops/nginx/ssl
    
    if [ ! -f "devops/nginx/ssl/cert.pem" ]; then
        openssl req -x509 -newkey rsa:4096 -keyout devops/nginx/ssl/key.pem -out devops/nginx/ssl/cert.pem -days 365 -nodes -subj "/C=US/ST=Dev/L=Local/O=MentalWellnessAI/CN=localhost"
        echo "✅ Development certificates generated!"
    else
        echo "✅ Development certificates already exist!"
    fi
}

# Run initial tests
run_tests() {
    echo "🧪 Running initial tests..."
    
    # Backend tests
    cd backend
    if npm run test:quick &> /dev/null; then
        echo "✅ Backend tests passed!"
    else
        echo "⚠️  Backend tests failed (this is normal for initial setup)"
    fi
    cd ..
    
    # Frontend tests
    cd frontend
    if npm test -- --watchAll=false &> /dev/null; then
        echo "✅ Frontend tests passed!"
    else
        echo "⚠️  Frontend tests failed (this is normal for initial setup)"
    fi
    cd ..
}

# Display setup completion information
show_completion_info() {
    echo ""
    echo "🎉 Development environment setup complete!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Update environment variables in backend/.env and frontend/.env"
    echo "2. Add your API keys (OpenAI, Gemini, Firebase)"
    echo "3. Start the development servers:"
    echo ""
    echo "   # Backend server"
    echo "   cd backend && npm run dev"
    echo ""
    echo "   # Frontend app (in another terminal)"
    echo "   cd frontend && npx expo start"
    echo ""
    echo "🌐 Your services will be available at:"
    echo "   • Backend API: http://localhost:5000"
    echo "   • Frontend App: http://localhost:19000 (Expo DevTools)"
    echo "   • MongoDB: mongodb://localhost:27017"
    echo "   • Redis: redis://localhost:6379"
    echo ""
    echo "📚 Documentation:"
    echo "   • Setup Guide: docs/SETUP.md"
    echo "   • API Docs: http://localhost:5000/api/docs (when backend is running)"
    echo ""
    echo "🆘 Need help? Check the troubleshooting section in docs/SETUP.md"
}

# Main execution
main() {
    check_prerequisites
    setup_environment
    create_directories
    setup_backend
    setup_frontend
    setup_services
    generate_certificates
    run_tests
    show_completion_info
}

# Run main function
main